using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DiscWeave.Api.Tests;

public sealed class OriginalTrackDiscoveryE2ETests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public OriginalTrackDiscoveryE2ETests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "External original workflow confirms a MusicBrainz-only Wanted import without file artifacts")]
    public async Task External_original_workflow_confirms_musicbrainz_only_wanted_import_without_file_artifacts()
    {
        var releaseMbid = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var recordingMbid = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var trackMbid = Guid.Parse("33333333-3333-3333-3333-333333333333");
        FakeExternalMetadataProvider musicBrainz = Provider(releaseMbid, recordingMbid, trackMbid);

        await using ApiTestHost host = await CreateHostAsync(musicBrainz);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceTrackId = await CreateSourceTrackAsync(client);

        using HttpResponseMessage create = await client.PostAsJsonAsync(
            "/api/imports/external-release-drafts",
            Request(sourceTrackId, releaseMbid, recordingMbid, trackMbid, "e2e-musicbrainz"));
        using JsonDocument created = await ReadJsonAsync(create);

        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        JsonElement draft = created.RootElement.GetProperty("drafts")[0];
        Assert.Equal("externalMetadata", draft.GetProperty("sourceKind").GetString());
        Assert.Equal(JsonValueKind.Array, draft.GetProperty("provenanceReleaseCandidates").ValueKind);
        Assert.Equal(JsonValueKind.Array, draft.GetProperty("provenanceTrackCandidates").ValueKind);

        Guid sessionId = created.RootElement.GetProperty("id").GetGuid();
        Guid draftId = draft.GetProperty("id").GetGuid();
        Guid draftTrackId = draft.GetProperty("tracks")[0].GetProperty("id").GetGuid();
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

        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);
        (int releases, int tracks, int wanted, int relations, bool original, int trackSources, int releaseSources) =
            await host.GetExternalCatalogStateAsync();
        Assert.Equal(1, releases);
        Assert.Equal(2, tracks);
        Assert.Equal(1, wanted);
        Assert.Equal(0, relations);
        Assert.True(original);
        Assert.Equal(2, trackSources);
        Assert.Equal(1, releaseSources);
        Assert.Empty(await host.LocalAudioFilesAsync());
        Assert.Empty(await host.DigitalTrackFileLinksAsync());
    }

    [Fact(DisplayName = "External provenance selection rejects a foreign collection Track")]
    public async Task External_provenance_selection_rejects_foreign_collection_track()
    {
        var releaseMbid = Guid.Parse("44444444-4444-4444-4444-444444444444");
        var recordingMbid = Guid.Parse("55555555-5555-5555-5555-555555555555");
        var trackMbid = Guid.Parse("66666666-6666-6666-6666-666666666666");
        FakeExternalMetadataProvider musicBrainz = Provider(releaseMbid, recordingMbid, trackMbid);

        await using ApiTestHost host = await CreateHostAsync(musicBrainz);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceTrackId = await CreateSourceTrackAsync(client);
        using JsonDocument created = await CreateDraftAsync(
            client,
            sourceTrackId,
            releaseMbid,
            recordingMbid,
            trackMbid,
            "e2e-provenance");
        Guid sessionId = created.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = created.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        long revision = draft.GetProperty("externalReviewRevision").GetInt64();
        Guid foreignTrackId = await host.SeedForeignTrackAsync("Foreign collection original");

        using HttpResponseMessage response = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/external-provenance/tracks/{foreignTrackId}",
            new { expectedReviewRevision = revision });
        using JsonDocument error = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(
            "import.external_provenance_selection_invalid",
            error.RootElement.GetProperty("code").GetString());
    }

    private async Task<ApiTestHost> CreateHostAsync(FakeExternalMetadataProvider musicBrainz)
    {
        FakeExternalMetadataProvider discogs = new("discogs");
        return await ApiTestHost.CreateAsync(
            _sqlite,
            services =>
            {
                _ = services.RemoveAll<ILocalOriginalCandidateService>();
                _ = services.AddSingleton<ILocalOriginalCandidateService>(new EligibleLocalCandidateService());
                FakeExternalMetadataProvider.Register(services, musicBrainz, discogs);
            });
    }

    private static async Task<Guid> CreateSourceTrackAsync(HttpClient client)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/tracks",
            new { title = "Remix source" });
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<JsonDocument> CreateDraftAsync(
        HttpClient client,
        Guid sourceTrackId,
        Guid releaseMbid,
        Guid recordingMbid,
        Guid trackMbid,
        string idempotencyKey)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/imports/external-release-drafts",
            Request(sourceTrackId, releaseMbid, recordingMbid, trackMbid, idempotencyKey));
        return await ReadJsonAsync(response);
    }

    private static object Request(
        Guid sourceTrackId,
        Guid releaseMbid,
        Guid recordingMbid,
        Guid trackMbid,
        string idempotencyKey)
    {
        return new
        {
            sourceTrackId,
            recordingMbid,
            musicBrainzRow = new { releaseMbid, mediumPosition = "1", trackMbid },
            reviewedRelationTypeCode = "remixOf",
            idempotencyKey
        };
    }

    private static FakeExternalMetadataProvider Provider(
        Guid releaseMbid,
        Guid recordingMbid,
        Guid trackMbid)
    {
        ExternalMetadataReleaseTrack track = new(
            "Blue Monday",
            "1",
            TimeSpan.FromSeconds(240),
            ["Artist"],
            "1",
            null,
            externalSources:
            [
                new ExternalMetadataSource("musicbrainz", "track", trackMbid.ToString("D"), $"https://musicbrainz.org/track/{trackMbid:D}", "MusicBrainz"),
                new ExternalMetadataSource("musicbrainz", "recording", recordingMbid.ToString("D"), $"https://musicbrainz.org/recording/{recordingMbid:D}", "MusicBrainz")
            ]);
        ExternalMetadataReleaseDetail detail = new(
            new ExternalMetadataSource("musicbrainz", "release", releaseMbid.ToString("D"), $"https://musicbrainz.org/release/{releaseMbid:D}", "MusicBrainz"),
            "Blue Monday",
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
            []);
        return new FakeExternalMetadataProvider("musicbrainz")
        {
            ReleaseDetailResult = new ExternalMetadataResult<ExternalMetadataReleaseDetail>(detail)
        };
    }

    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response)
    {
        string payload = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(payload);
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
