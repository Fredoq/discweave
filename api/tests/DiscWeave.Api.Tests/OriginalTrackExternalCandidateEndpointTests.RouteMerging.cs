using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalTrackExternalCandidateEndpointTests
{
    private static readonly bool[] _routeRichProviderVariants = [true, false];
    private static readonly string[] _routeProviderCodes = ["zeta", "alpha"];

    [Fact(DisplayName = "Duplicate provider routes preserve complementary evidence independent of provider order")]
    public async Task Duplicate_provider_routes_preserve_complementary_evidence_independent_of_provider_order()
    {
        var selectedId = Guid.Parse(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var candidateId = Guid.Parse(
            "11111111-1111-1111-1111-111111111111");
        var releaseId = Guid.Parse(
            "22222222-2222-2222-2222-222222222222");
        RecordingReleaseRoute incomplete = Route(releaseId, 1983) with
        {
            Date = null
        };
        RecordingReleaseRoute rich = Route(
            releaseId,
            1983,
            3,
            7,
            rerecordingContext: true) with
        {
            RelatedReleaseSources =
            [
                new ExternalMetadataSource(
                    "discogs",
                    "release",
                    "12345",
                    "https://www.discogs.com/release/12345",
                    "Discogs")
            ]
        };
        LocalOriginalCandidateResult local = EmptyLocalResult();
        string[] payloads = [];

        foreach (bool alphaIsRich in _routeRichProviderVariants)
        {
            FakeRecordingLineageProvider alpha = ProviderWithRoute(
                "alpha",
                selectedId,
                candidateId,
                alphaIsRich ? rich : incomplete);
            FakeRecordingLineageProvider zeta = ProviderWithRoute(
                "zeta",
                selectedId,
                candidateId,
                alphaIsRich ? incomplete : rich);
            await using ApiTestHost host =
                await CreateHostWithResultAsync(local, zeta, alpha);
            HttpClient client = await host.CreateAuthenticatedClientAsync();

            using HttpResponseMessage response = await client.PostAsJsonAsync(
                $"/api/tracks/{local.SourceTrackId.Value:D}"
                    + "/original-candidates/external",
                new { providerCodes = _routeProviderCodes });

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            string payload = await response.Content.ReadAsStringAsync();
            using var document = JsonDocument.Parse(payload);
            JsonElement root = document.RootElement;
            Assert.Equal(
                ["alpha", "zeta"],
                root.GetProperty("providerStatuses")
                    .EnumerateArray()
                    .Select(status =>
                        status.GetProperty("providerCode").GetString()));
            Assert.All(
                root.GetProperty("providerStatuses").EnumerateArray(),
                status => Assert.Equal(
                    "succeeded",
                    status.GetProperty("outcome").GetString()));
            JsonElement item = Assert.Single(
                root.GetProperty("items").EnumerateArray());
            Assert.Equal(
                ["musicbrainz", "discogs"],
                item.GetProperty("origins")
                    .EnumerateArray()
                    .Select(origin => origin.GetString()));
            Assert.Equal(
                ["1983-03-07", "day", "True"],
                DateValues(item));
            JsonElement route = Assert.Single(
                item.GetProperty("releaseRoutes").EnumerateArray());
            JsonElement routeDate = route.GetProperty("date");
            Assert.Equal(1983, routeDate.GetProperty("year").GetInt32());
            Assert.Equal(3, routeDate.GetProperty("month").GetInt32());
            Assert.Equal(7, routeDate.GetProperty("day").GetInt32());
            Assert.True(
                route.GetProperty("releaseGroupRerecordingContext")
                    .GetBoolean());
            Assert.Equal(
                "discogs",
                Assert.Single(
                    route.GetProperty("relatedReleaseSources")
                        .EnumerateArray())
                    .GetProperty("providerCode")
                    .GetString());
            payloads = [.. payloads, payload];
        }

        Assert.Equal(payloads[0], payloads[1]);
    }

    [Fact(DisplayName = "Conflicting nonnull route facts remain distinct")]
    public async Task Conflicting_nonnull_route_facts_remain_distinct()
    {
        var selectedId = Guid.Parse(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var candidateId = Guid.Parse(
            "11111111-1111-1111-1111-111111111111");
        var releaseId = Guid.Parse(
            "22222222-2222-2222-2222-222222222222");
        RecordingReleaseRoute baseline = Route(releaseId, 1983);
        RecordingReleaseRoute titleConflict = baseline with
        {
            Title = "Alternate release"
        };
        RecordingReleaseRoute dateConflict = baseline with
        {
            Date = new ProviderPartialDate { Year = 1984 }
        };
        RecordingReleaseRoute groupConflict = baseline with
        {
            ReleaseGroupSource = new ExternalMetadataSource(
                "musicbrainz",
                "release-group",
                "dddddddd-dddd-dddd-dddd-dddddddddddd",
                "https://musicbrainz.org/release-group/"
                    + "dddddddd-dddd-dddd-dddd-dddddddddddd",
                "MusicBrainz")
        };
        FakeRecordingLineageProvider alpha = ProviderWithRoutes(
            "alpha",
            selectedId,
            candidateId,
            baseline,
            titleConflict);
        FakeRecordingLineageProvider zeta = ProviderWithRoutes(
            "zeta",
            selectedId,
            candidateId,
            dateConflict,
            groupConflict);
        LocalOriginalCandidateResult local = EmptyLocalResult();

        ExternalOriginalCandidateResult result = await CreateService(
            local,
            zeta,
            alpha).FindAsync(
                CollectionId.New(),
                local.SourceTrackId,
                _routeProviderCodes,
                CancellationToken.None);

        ExternalOriginalCandidate candidate =
            Assert.Single(result.Candidates);
        Assert.Equal(4, candidate.ReleaseRoutes.Count);
        Assert.Equal(
            [
                "Alternate release|1983|bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
                $"Release {releaseId:D}|1983|bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
                $"Release {releaseId:D}|1983|dddddddd-dddd-dddd-dddd-dddddddddddd",
                $"Release {releaseId:D}|1984|bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
            ],
            candidate.ReleaseRoutes.Select(RouteFacts));
    }

    private static FakeRecordingLineageProvider ProviderWithRoute(
        string providerCode,
        Guid selectedId,
        Guid candidateId,
        RecordingReleaseRoute route)
    {
        return ProviderWithRoutes(
            providerCode,
            selectedId,
            candidateId,
            route);
    }

    private static FakeRecordingLineageProvider ProviderWithRoutes(
        string providerCode,
        Guid selectedId,
        Guid candidateId,
        params RecordingReleaseRoute[] routes)
    {
        return new FakeRecordingLineageProvider(providerCode)
        {
            Result = new ExternalMetadataResult<RecordingLineageResult>(
                LineageResult(
                    [
                        LineageCandidate(
                            candidateId,
                            [Relation(selectedId, candidateId)],
                            routes)
                    ],
                    RecordingSource(selectedId)))
        };
    }

    private static string RouteFacts(RecordingReleaseRoute route)
    {
        return string.Join(
            '|',
            route.Title,
            route.Date?.Year,
            route.ReleaseGroupSource.ExternalId);
    }
}
