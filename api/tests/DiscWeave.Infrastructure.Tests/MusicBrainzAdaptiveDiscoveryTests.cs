using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzLineageMappingTests
{
    [Fact]
    public async Task Versioned_recording_can_find_original_through_work_and_release_context()
    {
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path switch
            {
                _ when path.Contains($"/recording/{SelectedRemixMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(
                        SelectedRemixMbid,
                        "Selected (Radio Edit)",
                        [WorkRelation(WorkMbid)])),
                _ when path.Contains($"/work/{WorkMbid}", StringComparison.Ordinal) =>
                    JsonResponse(ReadFixture("work-dreaming-recordings.json")),
                _ when path.Contains($"/recording/{OriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(OriginalMbid, "Selected", relations: [])),
                _ when path.Contains($"/recording/{OtherOriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(OtherOriginalMbid, "Selected (Live)", relations: [])),
                _ when path.StartsWith("/ws/2/release?", StringComparison.Ordinal)
                    && path.Contains($"recording={OriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(SingleReleasePage(
                        OriginalMbid,
                        FirstReleaseMbid,
                        ForwardGroupMbid,
                        "1999-01-01")),
                _ when path.StartsWith("/ws/2/release?", StringComparison.Ordinal) =>
                    JsonResponse(SingleReleasePage(
                        OriginalMbid,
                        SecondReleaseMbid,
                        ReverseGroupMbid,
                        "2000-01-01",
                        trackTitle: "Selected")),
                _ => throw new InvalidOperationException(path)
            };
        });
        using var harness = new ProviderHarness(handler, ValidOptions(maxReleaseGroupLookups: 0));

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
        RecordingLineageCandidate candidate = Assert.Single(
            result.Value.Candidates,
            item => item.RecordingSource.ExternalId == OriginalMbid);
        Assert.Equal(OriginalMbid, candidate.RecordingSource.ExternalId);
        Assert.Contains(
            OriginalDiscoveryPath.SharedWorkPerformance,
            candidate.DiscoveryContext!.Paths);
        Assert.Contains(
            OriginalDiscoveryPath.SourceReleaseSibling,
            candidate.DiscoveryContext.Paths);
        Assert.Contains(
            candidate.DiscoveryContext.Evidence,
            evidence => evidence.Code == OriginalCandidateEvidenceCode.SharedWork);
        Assert.Contains(
            candidate.DiscoveryContext.Evidence,
            evidence => evidence.Code == OriginalCandidateEvidenceCode.BareBaseTitle);
        Assert.Contains(
            handler.Requests,
            request => request.RequestUri!.AbsolutePath == $"/ws/2/work/{WorkMbid}");
    }

    [Fact]
    public async Task Versioned_recording_without_work_uses_release_group_search()
    {
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path switch
            {
                _ when path.Contains($"/recording/{SelectedRemixMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(
                        SelectedRemixMbid,
                        "Selected (Radio Edit)",
                        relations: [])),
                _ when path.StartsWith("/ws/2/release-group?", StringComparison.Ordinal) =>
                    JsonResponse(ReadFixture("release-group-search-chase-the-sun.json")),
                _ when path.StartsWith("/ws/2/release?release-group=", StringComparison.Ordinal) =>
                    JsonResponse(SingleReleasePage(
                        OriginalMbid,
                        FirstReleaseMbid,
                        ForwardGroupMbid,
                        "1999-01-01",
                        trackTitle: "Selected")),
                _ when path.Contains($"/recording/{OriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(OriginalMbid, "Selected", relations: [])),
                _ when path.StartsWith("/ws/2/release?", StringComparison.Ordinal) =>
                    JsonResponse(SingleReleasePage(
                        OriginalMbid,
                        FirstReleaseMbid,
                        ForwardGroupMbid,
                        "1999-01-01")),
                _ => throw new InvalidOperationException(path)
            };
        });
        using var harness = new ProviderHarness(handler, ValidOptions(maxReleaseGroupLookups: 0));

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
        RecordingLineageCandidate candidate = Assert.Single(
            result.Value.Candidates,
            item => item.RecordingSource.ExternalId == OriginalMbid);
        Assert.Contains(
            OriginalDiscoveryPath.ReleaseGroupSearch,
            candidate.DiscoveryContext!.Paths);
        Assert.Contains(
            candidate.DiscoveryContext.Evidence,
            evidence => evidence.Code == OriginalCandidateEvidenceCode.SameReleaseGroup);
        Assert.Contains(
            handler.Requests,
            request => request.RequestUri!.AbsolutePath == "/ws/2/release-group");
    }

    [Fact]
    public async Task Versioned_recording_with_only_routeless_work_candidates_uses_release_group_search()
    {
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path switch
            {
                _ when path.Contains($"/recording/{SelectedRemixMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(
                        SelectedRemixMbid,
                        "Selected (Radio Edit)",
                        [WorkRelation(WorkMbid)])),
                _ when path.Contains($"/work/{WorkMbid}", StringComparison.Ordinal) =>
                    JsonResponse(SingleWorkRecording(OtherOriginalMbid, "Selected")),
                _ when path.Contains($"/recording/{OtherOriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(OtherOriginalMbid, "Selected", relations: [])),
                _ when path.Contains($"/recording/{OriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(OriginalMbid, "Selected", relations: [])),
                _ when path.StartsWith("/ws/2/release-group?", StringComparison.Ordinal) =>
                    JsonResponse(SingleReleaseGroup(ForwardGroupMbid, "Selected")),
                _ when path.StartsWith("/ws/2/release?release-group=", StringComparison.Ordinal) =>
                    JsonResponse(SingleReleasePageWithDisplayMetadata(
                        OriginalMbid,
                        FirstReleaseMbid,
                        ForwardGroupMbid,
                        "1995")),
                _ when path.StartsWith("/ws/2/release?", StringComparison.Ordinal)
                    && path.Contains($"recording={OriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(SingleReleasePage(
                        OriginalMbid,
                        FirstReleaseMbid,
                        ForwardGroupMbid,
                        "1995",
                        trackTitle: "Selected")),
                _ when path.StartsWith("/ws/2/release?", StringComparison.Ordinal) =>
                    JsonResponse(EmptyReleasePage()),
                _ => throw new InvalidOperationException(path)
            };
        });
        using var harness = new ProviderHarness(handler, ValidOptions(maxReleaseGroupLookups: 0));

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
        RecordingLineageCandidate candidate = Assert.Single(
            result.Value.Candidates,
            item => item.RecordingSource.ExternalId == OriginalMbid);
        Assert.NotEmpty(candidate.ReleaseRoutes);
        Assert.Contains(
            OriginalDiscoveryPath.ReleaseGroupSearch,
            candidate.DiscoveryContext!.Paths);
        Assert.Contains(
            handler.Requests,
            request => request.RequestUri!.AbsolutePath == "/ws/2/release-group");
    }

    [Fact]
    public async Task Release_first_search_uses_release_groups_without_loading_work_performances()
    {
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path switch
            {
                _ when path.Contains($"/recording/{SelectedRemixMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(
                        SelectedRemixMbid,
                        "Selected (Radio Edit)",
                        [WorkRelation(WorkMbid)])),
                _ when path.StartsWith("/ws/2/release-group?", StringComparison.Ordinal) =>
                    JsonResponse(SingleReleaseGroup(ForwardGroupMbid, "Selected")),
                _ when path.StartsWith("/ws/2/release?release-group=", StringComparison.Ordinal) =>
                    JsonResponse(SingleReleasePageWithDisplayMetadata(
                        OriginalMbid,
                        FirstReleaseMbid,
                        ForwardGroupMbid,
                        "1995")),
                _ when path.Contains($"/recording/{OriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(OriginalMbid, "Selected", relations: [])),
                _ when path.StartsWith("/ws/2/release?", StringComparison.Ordinal) =>
                    JsonResponse(SingleReleasePageWithDisplayMetadata(
                        OriginalMbid,
                        FirstReleaseMbid,
                        ForwardGroupMbid,
                        "1995")),
                _ when path.Contains($"/work/{WorkMbid}", StringComparison.Ordinal) =>
                    throw new Xunit.Sdk.XunitException("Release-first search must not load Work performances."),
                _ => throw new InvalidOperationException(path)
            };
        });
        using var harness = new ProviderHarness(handler, ValidOptions(maxReleaseGroupLookups: 0));

        ExternalMetadataResult<RecordingLineageResult> result = await harness.Provider.FindOriginalsAsync(
            new RecordingLineageQuery
            {
                Title = "Selected (Radio Edit)",
                BaseTitle = "Selected",
                Artists = ["Selected Artist"],
                KnownRecording = Source("recording", SelectedRemixMbid),
                SearchMode = OriginalDiscoverySearchMode.ReleaseFirst
            },
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        RecordingLineageCandidate candidate = Assert.Single(
            result.Value.Candidates,
            item => item.RecordingSource.ExternalId == OriginalMbid);
        Assert.Contains(
            OriginalDiscoveryPath.ReleaseGroupSearch,
            candidate.DiscoveryContext!.Paths);
        RecordingReleaseRoute route = Assert.Single(candidate.ReleaseRoutes);
        Assert.Equal(["Selected Artist"], route.Artists);
        Assert.Equal(["Musicnow Records"], route.Labels);
        Assert.Equal(["12\" Vinyl"], route.Formats);
        Assert.Equal("MNR-008", route.CatalogNumber);
        Assert.Equal("Selected", route.TrackTitle);
        Assert.Equal("B", route.TrackPosition);
        Assert.Equal(TimeSpan.FromMinutes(9) + TimeSpan.FromSeconds(54), route.TrackDuration);
        Assert.DoesNotContain(
            handler.Requests,
            request => request.RequestUri!.AbsolutePath.StartsWith("/ws/2/work/", StringComparison.Ordinal));
    }

}
