using System.Net;
using System.Text.Json.Nodes;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzExternalMetadataProviderTests
{
    [Fact]
    public async Task Release_browse_advances_by_actual_count_and_fetches_every_page_and_distinct_group_once()
    {
        var gate = new ImmediateRequestGate();
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path switch
            {
                _ when path.StartsWith("/ws/2/release?", StringComparison.Ordinal) &&
                    path.Contains("offset=0", StringComparison.Ordinal) =>
                    Task.FromResult(JsonResponse(ReadFixture("release-page-1.json"))),
                _ when path.StartsWith("/ws/2/release?", StringComparison.Ordinal) &&
                    path.Contains("offset=2", StringComparison.Ordinal) =>
                    Task.FromResult(JsonResponse(ReadFixture("release-page-2.json"))),
                _ when path.Contains("/release-group/20000000-0000-0000-0000-000000000001", StringComparison.Ordinal) =>
                    Task.FromResult(JsonResponse(ReadFixture("release-group-relations.json"))),
                _ when path.Contains("/release-group/20000000-0000-0000-0000-000000000002", StringComparison.Ordinal) =>
                    Task.FromResult(JsonResponse(
                        ReadFixture("release-group-relations.json")
                            .Replace("20000000-0000-0000-0000-000000000001", "20000000-0000-0000-0000-000000000002", StringComparison.Ordinal))),
                _ => throw new InvalidOperationException($"Unexpected path: {path}")
            };
        });
        using var harness = new ProviderHarness(
            handler,
            ValidOptions(),
            requestGate: gate);

        ExternalMetadataResult<MusicBrainzExternalMetadataProvider.ReleaseBrowseOutcome> result =
            await harness.Provider.BrowseReleasesAsync(
            "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA",
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value.Releases.Count);
        Assert.True(result.Value.ChronologyComplete);
        Assert.True(result.Value.ReleaseGroupContextComplete);
        Assert.Empty(result.Value.Warnings);
        Assert.Equal(
            [new DateOnly(1980, 2, 3), new DateOnly(1981, 1, 1), new DateOnly(1982, 4, 1)],
            result.Value.Releases.Select(release => release.ReleaseDate));
        Assert.Equal(
            [
                "/ws/2/release?recording=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa&limit=100&offset=0" +
                    "&inc=artist-credits+labels+recordings+release-groups+media+url-rels&fmt=json",
                "/ws/2/release?recording=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa&limit=100&offset=2" +
                    "&inc=artist-credits+labels+recordings+release-groups+media+url-rels&fmt=json"
            ],
            handler.Requests
                .Where(request => request.RequestUri!.AbsolutePath == "/ws/2/release")
                .Select(request => request.RequestUri!.PathAndQuery));
        Assert.Equal(4, gate.WaitCount);
    }

    [Fact]
    public async Task Intermediate_release_page_failure_preserves_completed_pages_and_marks_chronology_incomplete()
    {
        var gate = new ImmediateRequestGate();
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path.Contains("offset=0", StringComparison.Ordinal)
                ? Task.FromResult(JsonResponse(ReadFixture("release-page-1.json")))
                : Task.FromResult(JsonResponse("{}", HttpStatusCode.InternalServerError));
        });
        using var harness = new ProviderHarness(
            handler,
            ValidOptions(maxReleaseGroupLookups: 0),
            requestGate: gate);

        ExternalMetadataResult<MusicBrainzExternalMetadataProvider.ReleaseBrowseOutcome> result =
            await harness.Provider.BrowseReleasesAsync(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.Releases.Count);
        Assert.False(result.Value.ChronologyComplete);
        Assert.Contains("musicbrainz.release_chronology_incomplete", result.Value.Warnings);
        Assert.Equal(2, handler.CallCount);
    }

    [Fact]
    public async Task Invalid_route_rows_are_dropped_and_make_browse_chronology_incomplete()
    {
        string releasePage = WrapReleaseDetailAsPage(ReadFixture("release-detail.json"));
        var gate = new ImmediateRequestGate();
        var handler = new CapturingHandler((request, _) =>
        {
            return request.RequestUri!.AbsolutePath switch
            {
                "/ws/2/release" => Task.FromResult(JsonResponse(releasePage)),
                "/ws/2/release-group/20000000-0000-0000-0000-000000000001" =>
                    Task.FromResult(JsonResponse(ReadFixture("release-group-relations.json"))),
                _ => throw new InvalidOperationException(request.RequestUri.PathAndQuery)
            };
        });
        using var harness = new ProviderHarness(handler, ValidOptions(), requestGate: gate);

        ExternalMetadataResult<MusicBrainzExternalMetadataProvider.ReleaseBrowseOutcome> result =
            await harness.Provider.BrowseReleasesAsync(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        _ = Assert.Single(result.Value.Releases);
        _ = Assert.Single(result.Value.Releases[0].Tracks);
        Assert.False(result.Value.ChronologyComplete);
        Assert.Contains("musicbrainz.release_route_invalid", result.Value.Warnings);
    }

    [Fact]
    public async Task Release_group_lookup_cap_adds_context_warning_without_changing_complete_chronology()
    {
        var gate = new ImmediateRequestGate();
        CapturingHandler handler = BrowseHandlerWithSuccessfulGroups();
        using var harness = new ProviderHarness(
            handler,
            ValidOptions(maxReleaseGroupLookups: 1),
            requestGate: gate);

        ExternalMetadataResult<MusicBrainzExternalMetadataProvider.ReleaseBrowseOutcome> result =
            await harness.Provider.BrowseReleasesAsync(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.ChronologyComplete);
        Assert.False(result.Value.ReleaseGroupContextComplete);
        Assert.Contains("musicbrainz.release_group_context_incomplete", result.Value.Warnings);
        _ = Assert.Single(
            handler.Requests,
            request => request.RequestUri!.AbsolutePath.Contains("release-group", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Release_page_limit_returns_completed_data_with_a_stable_warning()
    {
        var gate = new ImmediateRequestGate();
        var handler = new CapturingHandler(
            (_, _) => Task.FromResult(JsonResponse(ReadFixture("release-page-1.json"))));
        using var harness = new ProviderHarness(
            handler,
            ValidOptions(maxReleasePages: 1, maxReleaseGroupLookups: 0),
            requestGate: gate);

        ExternalMetadataResult<MusicBrainzExternalMetadataProvider.ReleaseBrowseOutcome> result =
            await harness.Provider.BrowseReleasesAsync(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.Releases.Count);
        Assert.False(result.Value.ChronologyComplete);
        Assert.Contains("musicbrainz.release_page_limit_reached", result.Value.Warnings);
    }

    private static CapturingHandler BrowseHandlerWithSuccessfulGroups()
    {
        return new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            if (path.StartsWith("/ws/2/release?", StringComparison.Ordinal))
            {
                return Task.FromResult(JsonResponse(
                    path.Contains("offset=0", StringComparison.Ordinal)
                        ? ReadFixture("release-page-1.json")
                        : ReadFixture("release-page-2.json")));
            }

            string fixture = ReadFixture("release-group-relations.json");
            if (path.Contains("000000000002", StringComparison.Ordinal))
            {
                fixture = fixture.Replace(
                    "20000000-0000-0000-0000-000000000001",
                    "20000000-0000-0000-0000-000000000002",
                    StringComparison.Ordinal);
            }

            return Task.FromResult(JsonResponse(fixture));
        });
    }

    private static string WrapReleaseDetailAsPage(string releaseDetail)
    {
        JsonNode release = JsonNode.Parse(releaseDetail)!;
        JsonObject page = new()
        {
            ["release-count"] = 1,
            ["release-offset"] = 0,
            ["releases"] = new JsonArray(release)
        };
        return page.ToJsonString();
    }
}
