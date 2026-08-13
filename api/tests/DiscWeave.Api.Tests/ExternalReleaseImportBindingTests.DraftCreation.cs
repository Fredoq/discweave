using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DiscWeave.Api.Tests;

public sealed partial class ExternalReleaseImportBindingTests
{
    [Fact]
    public async Task Discogs_backed_draft_assigns_unique_positions_and_confirms()
    {
        var releaseMbid = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var recordingMbid = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var trackMbid = Guid.Parse("33333333-3333-3333-3333-333333333333");
        const string discogsReleaseId = "104110";
        FakeExternalMetadataProvider musicBrainz = new("musicbrainz")
        {
            ReleaseDetailResult = new ExternalMetadataResult<ExternalMetadataReleaseDetail>(
                AnomalyMusicBrainzDetail(
                    releaseMbid,
                    recordingMbid,
                    trackMbid,
                    discogsReleaseId))
        };
        FakeExternalMetadataProvider discogs = new("discogs")
        {
            ReleaseDetailResult = new ExternalMetadataResult<ExternalMetadataReleaseDetail>(
                AnomalyDiscogsDetail(discogsReleaseId))
        };

        await using ApiTestHost host = await ApiTestHost.CreateAsync(
            _sqlite,
            services =>
            {
                _ = services.RemoveAll<ILocalOriginalCandidateService>();
                _ = services.AddSingleton<ILocalOriginalCandidateService>(new EligibleLocalCandidateService());
                FakeExternalMetadataProvider.Register(services, musicBrainz, discogs);
            });
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceTrackId = await CreateSourceTrackAsync(client);
        string fingerprint = DiscogsReleaseRowFingerprint.Create(
            "A",
            "Anomaly (Calling Your Name)",
            [],
            TimeSpan.FromMinutes(9) + TimeSpan.FromSeconds(54));

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/imports/external-release-drafts",
            new
            {
                sourceTrackId,
                recordingMbid,
                musicBrainzRow = new { releaseMbid, mediumPosition = "1", trackMbid },
                discogsRoute = new
                {
                    releaseId = discogsReleaseId,
                    rowOrdinal = 0,
                    position = "A",
                    fingerprint
                },
                reviewedRelationTypeCode = "remixOf",
                idempotencyKey = "discogs-backed-position-normalization"
            });
        string payload = await response.Content.ReadAsStringAsync();

        Assert.True(response.StatusCode == HttpStatusCode.Created, payload);
        using var document = JsonDocument.Parse(payload);
        Guid sessionId = document.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = document.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        JsonElement tracks = draft.GetProperty("tracks");
        Assert.Equal([1, 2], tracks.EnumerateArray().Select(track => track.GetProperty("position").GetInt32()));
        Guid draftTrackId = tracks.EnumerateArray()
            .Single(track => track.GetProperty("isOriginal").GetBoolean())
            .GetProperty("id")
            .GetGuid();
        JsonElement binding = draft
            .GetProperty("selectedOriginalBinding")
            .GetProperty("discogsRow");
        Assert.Equal(discogsReleaseId, binding.GetProperty("releaseId").GetString());
        Assert.Equal(0, binding.GetProperty("rowOrdinal").GetInt32());

        await host.SetExternalDraftTrackPositionsAsync(draftId, position: 1);
        await host.ConfigureExternalDraftForConfirmationAsync(
            sessionId,
            draftId,
            draftTrackId,
            sourceTrackId,
            releaseMbid,
            recordingMbid,
            trackMbid);

        using HttpResponseMessage confirm = await client.PostAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirm",
            content: null);
        string confirmationPayload = await confirm.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);
        Assert.Contains("confirmed", confirmationPayload, StringComparison.Ordinal);
    }
}
