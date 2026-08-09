using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DiscWeave.Api.Tests;

public sealed partial class ExternalReleaseImportBindingTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public ExternalReleaseImportBindingTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact]
    public async Task Musicbrainz_rebind_replaces_the_reviewed_binding_with_authoritative_data()
    {
        var initialRelease = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var initialRecording = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var initialTrack = Guid.Parse("33333333-3333-3333-3333-333333333333");
        var replacementRelease = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var replacementRecording = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        var replacementTrack = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
        FakeExternalMetadataProvider musicBrainz = MetadataProvider(
            initialRelease,
            initialRecording,
            initialTrack,
            "Initial title");
        FakeExternalMetadataProvider discogs = new("discogs");

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
        using var created = JsonDocument.Parse(await (await client.PostAsJsonAsync(
            "/api/imports/external-release-drafts",
            new
            {
                sourceTrackId,
                recordingMbid = initialRecording,
                musicBrainzRow = new { releaseMbid = initialRelease, mediumPosition = "1", trackMbid = initialTrack },
                reviewedRelationTypeCode = "remixOf",
                idempotencyKey = "binding-rebind-test"
            })).Content.ReadAsStringAsync());
        Guid sessionId = created.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = created.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        long revision = draft.GetProperty("externalReviewRevision").GetInt64();

        musicBrainz.ReleaseDetailResult = new ExternalMetadataResult<ExternalMetadataReleaseDetail>(
            MetadataDetail("musicbrainz", replacementRelease, replacementRecording, replacementTrack, "Replacement title"));

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/external-binding/rebind/musicbrainz",
            new
            {
                recordingMbid = replacementRecording,
                musicBrainzRow = new
                {
                    releaseMbid = replacementRelease,
                    mediumPosition = "1",
                    trackMbid = replacementTrack
                },
                expectedReviewRevision = revision
            });
        string payload = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(replacementRelease.ToString("D"), payload, StringComparison.Ordinal);
        Assert.Contains(replacementRecording.ToString("D"), payload, StringComparison.Ordinal);
        Assert.Contains(replacementTrack.ToString("D"), payload, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Discogs_release_attach_resolves_the_compatible_row_and_persists_the_binding()
    {
        var releaseMbid = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var recordingMbid = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var trackMbid = Guid.Parse("33333333-3333-3333-3333-333333333333");
        const string discogsReleaseId = "104110";
        ExternalMetadataReleaseDetail musicBrainzDetail = AnomalyMusicBrainzDetail(
            releaseMbid,
            recordingMbid,
            trackMbid,
            discogsReleaseId);
        FakeExternalMetadataProvider musicBrainz = new("musicbrainz")
        {
            ReleaseDetailResult = new ExternalMetadataResult<ExternalMetadataReleaseDetail>(musicBrainzDetail)
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
        using var created = JsonDocument.Parse(await (await client.PostAsJsonAsync(
            "/api/imports/external-release-drafts",
            new
            {
                sourceTrackId,
                recordingMbid,
                musicBrainzRow = new { releaseMbid, mediumPosition = "1", trackMbid },
                reviewedRelationTypeCode = "remixOf",
                idempotencyKey = "discogs-release-attach-test"
            })).Content.ReadAsStringAsync());
        Guid sessionId = created.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = created.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        long revision = draft.GetProperty("externalReviewRevision").GetInt64();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/external-binding/attach-discogs-release",
            new { releaseId = discogsReleaseId, expectedReviewRevision = revision });
        string payload = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var responseDocument = JsonDocument.Parse(payload);
        JsonElement binding = responseDocument.RootElement
            .GetProperty("drafts")[0]
            .GetProperty("selectedOriginalBinding");
        Assert.Equal(discogsReleaseId, binding.GetProperty("discogsRow").GetProperty("releaseId").GetString());
        Assert.Equal(0, binding.GetProperty("discogsRow").GetProperty("rowOrdinal").GetInt32());
        Assert.Equal(
            discogsReleaseId,
            binding.GetProperty("releaseRoute").GetProperty("discogsRelease").GetProperty("externalId").GetString());

        JsonObject editableDraft = JsonNode.Parse(
            responseDocument.RootElement.GetProperty("drafts")[0].GetRawText())!.AsObject();
        editableDraft["collectionItemIntent"] = new JsonObject
        {
            ["kind"] = "newWanted",
            ["medium"] = new JsonObject { ["kind"] = "digital" }
        };
        using HttpResponseMessage saveResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}",
            editableDraft);
        string savePayload = await saveResponse.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, saveResponse.StatusCode);
        Assert.DoesNotContain("import.external_binding_read_only", savePayload, StringComparison.Ordinal);
    }

    private static async Task<Guid> CreateSourceTrackAsync(HttpClient client)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/tracks",
            new { title = "Remix source" });
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static FakeExternalMetadataProvider MetadataProvider(
        Guid releaseMbid,
        Guid recordingMbid,
        Guid trackMbid,
        string title)
    {
        return new FakeExternalMetadataProvider("musicbrainz")
        {
            ReleaseDetailResult = new ExternalMetadataResult<ExternalMetadataReleaseDetail>(
                MetadataDetail("musicbrainz", releaseMbid, recordingMbid, trackMbid, title))
        };
    }

    private static ExternalMetadataReleaseDetail MetadataDetail(
        string providerCode,
        Guid releaseMbid,
        Guid recordingMbid,
        Guid trackMbid,
        string title,
        IReadOnlyList<ExternalMetadataSource>? relatedSources = null)
    {
        ExternalMetadataReleaseTrack track = new(
            title,
            "1",
            TimeSpan.FromSeconds(240),
            ["Artist"],
            "1",
            null,
            externalSources:
            [
                new ExternalMetadataSource(providerCode, "track", trackMbid.ToString("D"), $"https://musicbrainz.org/track/{trackMbid:D}", "MusicBrainz"),
                new ExternalMetadataSource(providerCode, "recording", recordingMbid.ToString("D"), $"https://musicbrainz.org/recording/{recordingMbid:D}", "MusicBrainz")
            ]);
        return new ExternalMetadataReleaseDetail(
            new ExternalMetadataSource(providerCode, "release", releaseMbid.ToString("D"), $"https://musicbrainz.org/release/{releaseMbid:D}", "MusicBrainz"),
            title,
            ["Artist"],
            1983,
            new DateOnly(1983, 3, 7),
            ["Label"],
            [],
            "single",
            [],
            [track],
            [],
            null,
            [],
            [],
            relatedSources: relatedSources);
    }

    private sealed class EligibleLocalCandidateService : ILocalOriginalCandidateService
    {
        public Task<LocalOriginalCandidateResult> FindAsync(
            CollectionId collectionId,
            TrackId sourceTrackId,
            CancellationToken cancellationToken)
        {
            _ = collectionId;
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult(new LocalOriginalCandidateResult
            {
                Status = LocalOriginalCandidateStatus.Success,
                SourceTrackId = sourceTrackId,
                Candidates = []
            });
        }
    }
}
