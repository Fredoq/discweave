using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DiscWeave.Api.Tests;

public sealed class ExternalReleaseDraftEndpointTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public ExternalReleaseDraftEndpointTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact]
    public async Task Creates_musicbrainz_draft_with_authoritative_provider_lookup()
    {
        var releaseMbid = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var recordingMbid = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var trackMbid = Guid.Parse("33333333-3333-3333-3333-333333333333");
        Guid sourceTrackId;
        FakeExternalMetadataProvider musicBrainz = Provider("musicbrainz", releaseMbid, recordingMbid, trackMbid);
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

        using (HttpResponseMessage createTrack = await client.PostAsJsonAsync(
                   "/api/tracks",
                   new { title = "Blue Monday (Remix)" }))
        {
            using JsonDocument trackDocument = await JsonDocument.ParseAsync(
                await createTrack.Content.ReadAsStreamAsync());
            Assert.Equal(HttpStatusCode.Created, createTrack.StatusCode);
            sourceTrackId = trackDocument.RootElement.GetProperty("id").GetGuid();
        }

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/imports/external-release-drafts",
            new
            {
                sourceTrackId,
                recordingMbid,
                musicBrainzRow = new
                {
                    releaseMbid,
                    mediumPosition = "1",
                    trackMbid
                },
                reviewedRelationTypeCode = "remixOf",
                idempotencyKey = "external-draft-test-1"
            });

        string responsePayload = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.Created, responsePayload);
        Assert.Equal(ExternalMetadataRequestFreshness.Authoritative, musicBrainz.LastReleaseFreshness);
        using var document = JsonDocument.Parse(responsePayload);
        Assert.NotEqual(Guid.Empty, document.RootElement.GetProperty("id").GetGuid());
        JsonElement intent = document.RootElement
            .GetProperty("drafts")[0]
            .GetProperty("collectionItemIntent");
        Assert.Equal("newWanted", intent.GetProperty("kind").GetString());
        JsonElement medium = intent.GetProperty("medium");
        Assert.Equal("vinyl", medium.GetProperty("kind").GetString());
        Assert.Equal("12\"", medium.GetProperty("formatDescription").GetString());
    }

    [Fact]
    public async Task Missing_source_track_returns_not_found_before_provider_calls()
    {
        FakeExternalMetadataProvider musicBrainz = new("musicbrainz");
        FakeExternalMetadataProvider discogs = new("discogs");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(
            _sqlite,
            services => FakeExternalMetadataProvider.Register(services, musicBrainz, discogs));
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/imports/external-release-drafts",
            new
            {
                sourceTrackId = Guid.NewGuid(),
                recordingMbid = Guid.NewGuid(),
                musicBrainzRow = new
                {
                    releaseMbid = Guid.NewGuid(),
                    mediumPosition = "1",
                    trackMbid = Guid.NewGuid()
                },
                reviewedRelationTypeCode = "remixOf",
                idempotencyKey = "missing-source"
            });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Null(musicBrainz.LastReleaseLookupQuery);
    }

    [Fact]
    public async Task Identical_idempotency_replay_returns_the_same_session_without_provider_calls()
    {
        var releaseMbid = Guid.Parse("44444444-4444-4444-4444-444444444444");
        var recordingMbid = Guid.Parse("55555555-5555-5555-5555-555555555555");
        var trackMbid = Guid.Parse("66666666-6666-6666-6666-666666666666");
        FakeExternalMetadataProvider musicBrainz = Provider("musicbrainz", releaseMbid, recordingMbid, trackMbid);
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
        Guid sourceTrackId;
        using (HttpResponseMessage createTrack = await client.PostAsJsonAsync(
                   "/api/tracks",
                   new { title = "Blue Monday (Remix)" }))
        {
            using JsonDocument trackDocument = await JsonDocument.ParseAsync(
                await createTrack.Content.ReadAsStreamAsync());
            sourceTrackId = trackDocument.RootElement.GetProperty("id").GetGuid();
        }

        var request = new
        {
            sourceTrackId,
            recordingMbid,
            musicBrainzRow = new { releaseMbid, mediumPosition = "1", trackMbid },
            reviewedRelationTypeCode = "remixOf",
            idempotencyKey = "external-draft-replay"
        };
        using HttpResponseMessage first = await client.PostAsJsonAsync(
            "/api/imports/external-release-drafts",
            request);
        using var firstDocument = JsonDocument.Parse(await first.Content.ReadAsStringAsync());
        Guid sessionId = firstDocument.RootElement.GetProperty("id").GetGuid();
        musicBrainz.ReleaseDetailResult = new ExternalMetadataResult<ExternalMetadataReleaseDetail>(
            new ExternalMetadataError(
                ExternalMetadataErrorKind.Unavailable,
                "external_metadata.offline",
                "offline"));

        using HttpResponseMessage second = await client.PostAsJsonAsync(
            "/api/imports/external-release-drafts",
            request);
        using var secondDocument = JsonDocument.Parse(await second.Content.ReadAsStringAsync());

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        Assert.Equal(sessionId, secondDocument.RootElement.GetProperty("id").GetGuid());
        Assert.Equal(1, musicBrainz.ReleaseLookupCallCount);
    }

    [Fact]
    public async Task Invalid_idempotency_key_is_rejected_before_provider_lookup()
    {
        FakeExternalMetadataProvider musicBrainz = new("musicbrainz");
        FakeExternalMetadataProvider discogs = new("discogs");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(
            _sqlite,
            services => FakeExternalMetadataProvider.Register(services, musicBrainz, discogs));
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceTrackId;
        using (HttpResponseMessage createTrack = await client.PostAsJsonAsync(
                   "/api/tracks",
                   new { title = "Blue Monday (Remix)" }))
        {
            using JsonDocument trackDocument = await JsonDocument.ParseAsync(
                await createTrack.Content.ReadAsStreamAsync());
            sourceTrackId = trackDocument.RootElement.GetProperty("id").GetGuid();
        }

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/imports/external-release-drafts",
            new
            {
                sourceTrackId,
                recordingMbid = Guid.NewGuid(),
                musicBrainzRow = new
                {
                    releaseMbid = Guid.NewGuid(),
                    mediumPosition = "1",
                    trackMbid = Guid.NewGuid()
                },
                reviewedRelationTypeCode = "remixOf",
                idempotencyKey = "   "
            });
        string payload = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("import.external_request_invalid", payload, StringComparison.Ordinal);
        Assert.Equal(0, musicBrainz.ReleaseLookupCallCount);
    }

    private static FakeExternalMetadataProvider Provider(
        string providerCode,
        Guid releaseMbid,
        Guid recordingMbid,
        Guid trackMbid)
    {
        ExternalMetadataSource releaseSource = new(
            providerCode,
            "release",
            releaseMbid.ToString("D"),
            $"https://musicbrainz.org/release/{releaseMbid:D}",
            "MusicBrainz");
        ExternalMetadataReleaseTrack track = new(
            "Blue Monday",
            "1",
            TimeSpan.FromSeconds(260),
            ["New Order"],
            "1",
            null,
            externalSources:
            [
                new ExternalMetadataSource(
                    providerCode,
                    "track",
                    trackMbid.ToString("D"),
                    $"https://musicbrainz.org/track/{trackMbid:D}",
                    "MusicBrainz"),
                new ExternalMetadataSource(
                    providerCode,
                    "recording",
                    recordingMbid.ToString("D"),
                    $"https://musicbrainz.org/recording/{recordingMbid:D}",
                    "MusicBrainz")
            ]);
        ExternalMetadataReleaseDetail detail = new(
            releaseSource,
            "Blue Monday",
            ["New Order"],
            1983,
            new DateOnly(1983, 3, 7),
            ["Factory"],
            ["12\""],
            "album",
            [],
            [track],
            [],
            "FAC 73",
            [],
            []);
        return new FakeExternalMetadataProvider(providerCode)
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
