using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DiscWeave.Api.Tests;

public sealed partial class ExternalReleaseDraftEndpointTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Discogs_only_original_draft_persists_without_musicbrainz_identifiers(bool changeReleaseArtist)
    {
        ExternalMetadataReleaseTrack track = new("Nice", "1", TimeSpan.FromSeconds(207), [], "1", null);
        ExternalMetadataReleaseDetail detail = new(
            new ExternalMetadataSource("discogs", "release", "12345", "https://www.discogs.com/release/12345", "Discogs"),
            "Nice", ["Duran Duran"], 2005, null, ["Epic"], ["CD"], "single", [], [track], [], null, [], []);
        var discogs = new FakeExternalMetadataProvider("discogs")
        {
            ReleaseDetailResult = new ExternalMetadataResult<ExternalMetadataReleaseDetail>(detail)
        };
        var musicBrainz = new FakeExternalMetadataProvider("musicbrainz");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite, services =>
        {
            _ = services.RemoveAll<ILocalOriginalCandidateService>();
            _ = services.AddSingleton<ILocalOriginalCandidateService>(new EligibleLocalCandidateService());
            FakeExternalMetadataProvider.Register(services, musicBrainz, discogs);
        });
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceTrackId = await CreateSourceTrackAsync(client);
        var request = new
        {
            sourceTrackId,
            discogsRoute = new
            {
                releaseId = "12345",
                rowOrdinal = 0,
                position = "1",
                fingerprint = DiscogsReleaseRowFingerprint.Create(track.Position, track.Title, detail.Artists, track.Duration)
            },
            reviewedRelationTypeCode = "remixOf",
            idempotencyKey = "discogs-original"
        };
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/imports/external-release-drafts", request);
        string payload = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.Created, payload);
        using var document = JsonDocument.Parse(payload);
        JsonElement binding = document.RootElement.GetProperty("drafts")[0].GetProperty("selectedOriginalBinding");
        Assert.Equal(JsonValueKind.Null, binding.GetProperty("recordingSource").ValueKind);
        Assert.Equal(JsonValueKind.Null, binding.GetProperty("musicBrainzRow").ValueKind);
        Assert.Equal("12345", binding.GetProperty("discogsRow").GetProperty("releaseId").GetString());
        using HttpResponseMessage replay = await client.PostAsJsonAsync("/api/imports/external-release-drafts", request);
        Assert.Equal(HttpStatusCode.Created, replay.StatusCode);
        Guid sessionId = document.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = document.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        Guid draftTrackId = draft.GetProperty("tracks")[0].GetProperty("id").GetGuid();
        Guid suggestionId = document.RootElement.GetProperty("relationSuggestions")[0].GetProperty("id").GetGuid();
        using HttpResponseMessage accept = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/relation-suggestions/{suggestionId}", new
            {
                decision = "accepted",
                reviewed = new
                {
                    source = new { kind = "existingTrack", id = sourceTrackId },
                    target = new { kind = "draftTrack", id = draftTrackId },
                    relationTypeCode = "remixOf"
                }
            });
        Assert.True(accept.IsSuccessStatusCode, await accept.Content.ReadAsStringAsync());
        ExternalMetadataReleaseTrack changedTrack = new(changeReleaseArtist ? "Nice" : "Nice (Remix)", "1", TimeSpan.FromSeconds(207), [], "1", null);
        discogs.ReleaseDetailResult = new ExternalMetadataResult<ExternalMetadataReleaseDetail>(new ExternalMetadataReleaseDetail(
            detail.Source, detail.Title, changeReleaseArtist ? ["Another Artist"] : detail.Artists, detail.Year, detail.ReleaseDate, detail.Labels, detail.Formats,
            detail.Type, [], [changedTrack], [], null, [], []));
        using HttpResponseMessage stale = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", null);
        Assert.Equal(HttpStatusCode.BadRequest, stale.StatusCode);
        using var staleError = JsonDocument.Parse(await stale.Content.ReadAsStringAsync());
        Assert.Equal("import.external_binding_stale", staleError.RootElement.GetProperty("code").GetString());
        (int releasesBefore, int tracksBefore, int _, int relationsBefore, bool _, int _, int _) = await host.GetExternalCatalogStateAsync();
        Assert.Equal(0, releasesBefore);
        Assert.Equal(1, tracksBefore);
        Assert.Equal(0, relationsBefore);
        discogs.ReleaseDetailResult = new ExternalMetadataResult<ExternalMetadataReleaseDetail>(detail);
        using HttpResponseMessage confirm = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", null);
        Assert.True(confirm.IsSuccessStatusCode, await confirm.Content.ReadAsStringAsync());
        (int releases, int tracks, int wanted, int relations, bool original, int trackSources, int _) = await host.GetExternalCatalogStateAsync();
        Assert.Equal(1, releases);
        Assert.Equal(2, tracks);
        Assert.Equal(1, relations);
        Assert.True(original);
        Assert.Equal(1, wanted);
        Assert.Equal(1, trackSources);
        Guid secondSourceTrackId = await CreateSourceTrackAsync(client);
        using HttpResponseMessage second = await client.PostAsJsonAsync("/api/imports/external-release-drafts", new
        {
            sourceTrackId = secondSourceTrackId,
            request.discogsRoute,
            request.reviewedRelationTypeCode,
            idempotencyKey = "discogs-original-reuse"
        });
        Assert.True(second.StatusCode == HttpStatusCode.Created, await second.Content.ReadAsStringAsync());
        using var secondDocument = JsonDocument.Parse(await second.Content.ReadAsStringAsync());
        JsonElement secondDraft = secondDocument.RootElement.GetProperty("drafts")[0];
        _ = Assert.Single(secondDraft.GetProperty("provenanceTrackCandidates").EnumerateArray());
        _ = Assert.Single(secondDraft.GetProperty("provenanceReleaseCandidates").EnumerateArray());
        Assert.Equal("link", secondDraft.GetProperty("tracks")[0].GetProperty("trackMode").GetString());
        Assert.Null(musicBrainz.LastReleaseLookupQuery);
    }
}
