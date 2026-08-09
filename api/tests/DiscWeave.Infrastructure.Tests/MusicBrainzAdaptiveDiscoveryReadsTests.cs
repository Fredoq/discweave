using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;
using System.Text.Json.Nodes;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzLineageMappingTests
{
    [Fact]
    public async Task Work_context_marks_malformed_recording_targets_incomplete()
    {
        string response = new JsonObject
        {
            ["id"] = WorkMbid,
            ["title"] = "Selected",
            ["relations"] = new JsonArray
            {
                new JsonObject
                {
                    ["target-type"] = "recording",
                    ["recording"] = new JsonObject
                    {
                        ["id"] = OriginalMbid
                    }
                }
            }
        }.ToJsonString();
        var handler = new CapturingHandler((request, _) =>
            request.RequestUri!.PathAndQuery.Contains($"/work/{WorkMbid}", StringComparison.Ordinal)
                ? JsonResponse(response)
                : throw new InvalidOperationException(request.RequestUri.PathAndQuery));
        using var harness = new ProviderHarness(handler, ValidOptions());
        using MusicBrainzOperationContext context = harness.Provider.CreateOperationContext();

        ExternalMetadataResult<MusicBrainzExternalMetadataProvider.WorkPerformanceOutcome> result =
            await harness.Provider.GetWorkPerformancesAsync(WorkMbid, context, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.Complete);
        Assert.Empty(result.Value.Recordings);
        Assert.Equal(["musicbrainz.work_context_incomplete"], result.Value.Warnings);
    }

    [Fact]
    public async Task Adaptive_work_lane_respects_operation_budget_before_candidate_detail()
    {
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path switch
            {
                _ when path.Contains($"/recording/{SelectedRemixMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(SelectedRemixMbid, "Selected (Radio Edit)", [WorkRelation(WorkMbid)])),
                _ when path.Contains($"/work/{WorkMbid}", StringComparison.Ordinal) =>
                    JsonResponse(ReadFixture("work-dreaming-recordings.json")),
                _ => throw new InvalidOperationException(path)
            };
        });
        using var harness = new ProviderHarness(
            handler,
            ValidOptions(maxRequestsPerOperation: 2));

        ExternalMetadataResult<RecordingLineageResult> result = await harness.Provider.FindOriginalsAsync(
            new RecordingLineageQuery
            {
                Title = "Selected (Radio Edit)",
                BaseTitle = "Selected",
                Artists = ["Selected Artist"],
                KnownRecording = Source("recording", SelectedRemixMbid)
            },
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value.Candidates);
        Assert.False(result.Value.ChronologyComplete);
        Assert.Contains("musicbrainz.operation_budget_exhausted", result.Value.Warnings);
        Assert.Equal(2, handler.CallCount);
    }

    [Fact]
    public async Task Work_lookup_maps_recording_performances_and_deduplicates_ids()
    {
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path.Contains($"/work/{WorkMbid}", StringComparison.Ordinal)
                ? JsonResponse(ReadFixture("work-dreaming-recordings.json"))
                : throw new InvalidOperationException(path);
        });
        using var harness = new ProviderHarness(handler, ValidOptions());
        using MusicBrainzOperationContext context = harness.Provider.CreateOperationContext();

        ExternalMetadataResult<MusicBrainzExternalMetadataProvider.WorkPerformanceOutcome> result =
            await harness.Provider.GetWorkPerformancesAsync(
                WorkMbid,
                context,
                CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(
            [OriginalMbid, OtherOriginalMbid],
            result.Value.Recordings.Select(recording => recording.Mbid));
        Assert.Equal("Dreaming", result.Value.Title);
        Assert.True(result.Value.Complete);
        Assert.Contains(
            handler.Requests,
            request => request.RequestUri!.PathAndQuery.Contains(
                "inc=recording-rels",
                StringComparison.Ordinal));
    }

    [Fact]
    public async Task Release_group_search_maps_bounded_hypotheses_and_preserves_query_url()
    {
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path.StartsWith("/ws/2/release-group?", StringComparison.Ordinal)
                ? JsonResponse(ReadFixture("release-group-search-chase-the-sun.json"))
                : throw new InvalidOperationException(path);
        });
        using var harness = new ProviderHarness(handler, ValidOptions());
        using MusicBrainzOperationContext context = harness.Provider.CreateOperationContext();

        ExternalMetadataResult<MusicBrainzExternalMetadataProvider.ReleaseGroupSearchOutcome> result =
            await harness.Provider.SearchReleaseGroupsAsync(
                "releasegroup:\"Chase the Sun\" AND artist:\"Planet Funk\"",
                context,
                CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.Total);
        Assert.Equal(
            [ForwardGroupMbid, ReverseGroupMbid],
            result.Value.Groups.Select(group => group.Mbid));
        Assert.Contains(
            "releasegroup%3A%22Chase%20the%20Sun%22",
            handler.Requests.Single().RequestUri!.PathAndQuery,
            StringComparison.Ordinal);
        Assert.Contains(
            "limit=5",
            handler.Requests.Single().RequestUri!.PathAndQuery,
            StringComparison.Ordinal);
    }

    [Fact]
    public async Task Source_release_context_maps_all_sibling_tracks_and_release_metadata()
    {
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path.StartsWith("/ws/2/release?", StringComparison.Ordinal)
                ? JsonResponse(ReadFixture("release-st3.json"))
                : throw new InvalidOperationException(path);
        });
        using var harness = new ProviderHarness(handler, ValidOptions());
        using MusicBrainzOperationContext context = harness.Provider.CreateOperationContext();

        ExternalMetadataResult<MusicBrainzExternalMetadataProvider.ReleaseContextOutcome> result =
            await harness.Provider.BrowseSourceReleaseContextAsync(
                OriginalMbid,
                context,
                CancellationToken.None);

        Assert.True(result.IsSuccess);
        MusicBrainzExternalMetadataProvider.ReleaseRoute release =
            Assert.Single(result.Value.Releases);
        Assert.Equal("Official", release.Status);
        Assert.Equal("GB", release.Country);
        Assert.Equal("Album", release.PrimaryType);
        Assert.Equal(2, release.Tracks.Count);
        Assert.Contains(release.Tracks, track => track.Title == "Eugina");
        Assert.True(result.Value.Complete);
    }
}
