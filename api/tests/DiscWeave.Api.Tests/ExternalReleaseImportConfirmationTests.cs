using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DiscWeave.Api.Tests;

public sealed class ExternalReleaseImportConfirmationTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public ExternalReleaseImportConfirmationTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact]
    public async Task Confirms_musicbrainz_original_to_wanted_without_local_file_artifacts()
    {
        var releaseMbid = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var recordingMbid = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var trackMbid = Guid.Parse("33333333-3333-3333-3333-333333333333");
        FakeExternalMetadataProvider musicBrainz = Provider(releaseMbid, recordingMbid, trackMbid);
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
        using HttpResponseMessage create = await client.PostAsJsonAsync(
            "/api/imports/external-release-drafts",
            new
            {
                sourceTrackId,
                recordingMbid,
                musicBrainzRow = new { releaseMbid, mediumPosition = "1", trackMbid },
                reviewedRelationTypeCode = "remixOf",
                idempotencyKey = "external-confirmation-test"
            });
        using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        Guid sessionId = created.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = created.RootElement.GetProperty("drafts")[0];
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
        string confirmationPayload = await confirm.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);
        Assert.Contains("confirmed", confirmationPayload, StringComparison.Ordinal);

        (int releaseCount, int trackCount, int wantedCount, int relationCount, bool original, int trackSources, int releaseSources) =
            await host.GetExternalCatalogStateAsync();
        Assert.Equal(1, releaseCount);
        Assert.Equal(2, trackCount);
        Assert.Equal(1, wantedCount);
        Assert.Equal(0, relationCount);
        Assert.True(original);
        Assert.Equal(2, trackSources);
        Assert.Equal(1, releaseSources);
    }

    [Fact]
    public async Task Reusing_existing_release_preserves_release_track_and_digital_file_link()
    {
        var releaseMbid = Guid.Parse("77777777-7777-7777-7777-777777777777");
        var recordingMbid = Guid.Parse("88888888-8888-8888-8888-888888888888");
        var trackMbid = Guid.Parse("99999999-9999-9999-9999-999999999999");
        FakeExternalMetadataProvider musicBrainz = Provider(releaseMbid, recordingMbid, trackMbid);
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
        (Guid releaseId, _, Guid releaseTrackId, Guid ownedItemId) =
            await host.SeedExternalReleaseWithTrackAsync(releaseMbid, recordingMbid, trackMbid);
        DigitalFileSeed linkedFile = await host.SeedDigitalTrackFileLinkAsync(
            releaseId,
            ownedItemId,
            releaseTrackPosition: 1,
            "/music/original.flac",
            "flac",
            "ORIGINAL-HASH");

        using HttpResponseMessage create = await client.PostAsJsonAsync(
            "/api/imports/external-release-drafts",
            new
            {
                sourceTrackId,
                recordingMbid,
                musicBrainzRow = new { releaseMbid, mediumPosition = "1", trackMbid },
                reviewedRelationTypeCode = "remixOf",
                idempotencyKey = "external-confirmation-existing-release"
            });
        using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        Guid sessionId = created.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = created.RootElement.GetProperty("drafts")[0];
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

        Assert.True(
            confirm.StatusCode == HttpStatusCode.OK,
            $"{confirm.StatusCode}: {await confirm.Content.ReadAsStringAsync()}");
        DigitalTrackFileLinkSnapshot preservedLink = Assert.Single(await host.DigitalTrackFileLinksAsync());
        Assert.Equal(linkedFile.LinkId, preservedLink.Id);
        Assert.Equal(linkedFile.LocalAudioFileId, preservedLink.LocalAudioFileId);
        Assert.Equal(releaseTrackId, preservedLink.ReleaseTrackId);
    }

    private static async Task<Guid> CreateSourceTrackAsync(HttpClient client)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/tracks",
            new { title = "Remix source" });
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.GetProperty("id").GetGuid();
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
