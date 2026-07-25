using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzLineageMappingTests
{
    [Fact]
    public async Task Release_group_direction_marks_only_the_forward_rerecording_route()
    {
        string source = RecordingDetail(
            SelectedRemixMbid,
            "Selected",
            [
                RecordingRelation("remix", "forward", OriginalMbid),
                RecordingRelation("edit", "forward", OtherOriginalMbid)
            ]);
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path switch
            {
                _ when path.Contains($"/recording/{SelectedRemixMbid}", StringComparison.Ordinal) =>
                    JsonResponse(source),
                _ when path.Contains($"/recording/{OriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(OriginalMbid, "First", relations: [])),
                _ when path.Contains($"/recording/{OtherOriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(OtherOriginalMbid, "Second", relations: [])),
                _ when path.StartsWith("/ws/2/release?", StringComparison.Ordinal) &&
                    path.Contains(OriginalMbid, StringComparison.Ordinal) =>
                    JsonResponse(SingleReleasePage(
                        OriginalMbid,
                        FirstReleaseMbid,
                        ForwardGroupMbid,
                        "1980")),
                _ when path.StartsWith("/ws/2/release?", StringComparison.Ordinal) =>
                    JsonResponse(SingleReleasePage(
                        OtherOriginalMbid,
                        SecondReleaseMbid,
                        ReverseGroupMbid,
                        "1981")),
                _ when path.Contains($"/release-group/{ForwardGroupMbid}", StringComparison.Ordinal) =>
                    JsonResponse(ReadFixture("release-group-rerecording.json")),
                _ when path.Contains($"/release-group/{ReverseGroupMbid}", StringComparison.Ordinal) =>
                    JsonResponse(ReadFixture("release-group-has-rerecordings.json")),
                _ => throw new InvalidOperationException(path)
            };
        });
        using var harness = new ProviderHarness(handler, ValidOptions());
        MusicBrainzExternalMetadataProvider provider = harness.Provider;

        ExternalMetadataResult<RecordingLineageResult> result = await provider.FindOriginalsAsync(
            KnownQuery(SelectedRemixMbid),
            CancellationToken.None);

        Assert.True(Assert.Single(result.Value.Candidates[0].ReleaseRoutes).ReleaseGroupRerecordingContext);
        Assert.False(Assert.Single(result.Value.Candidates[1].ReleaseRoutes).ReleaseGroupRerecordingContext);
        Assert.All(result.Value.Candidates, candidate => Assert.True(candidate.ChronologyComplete));
        Assert.True(result.Value.ChronologyComplete);
    }

    [Fact]
    public async Task Release_group_cap_is_shared_across_candidates_and_does_not_change_chronology()
    {
        string source = RecordingDetail(
            SelectedRemixMbid,
            "Selected",
            [
                RecordingRelation("remix", "forward", OriginalMbid),
                RecordingRelation("edit", "forward", OtherOriginalMbid)
            ]);
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path switch
            {
                _ when path.Contains($"/recording/{SelectedRemixMbid}", StringComparison.Ordinal) =>
                    JsonResponse(source),
                _ when path.Contains($"/recording/{OriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(OriginalMbid, "First", relations: [])),
                _ when path.Contains($"/recording/{OtherOriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(OtherOriginalMbid, "Second", relations: [])),
                _ when path.StartsWith("/ws/2/release?", StringComparison.Ordinal) &&
                    path.Contains(OriginalMbid, StringComparison.Ordinal) =>
                    JsonResponse(SingleReleasePage(
                        OriginalMbid,
                        FirstReleaseMbid,
                        ForwardGroupMbid,
                        "1980")),
                _ when path.StartsWith("/ws/2/release?", StringComparison.Ordinal) =>
                    JsonResponse(SingleReleasePage(
                        OtherOriginalMbid,
                        SecondReleaseMbid,
                        ReverseGroupMbid,
                        "1981")),
                _ when path.Contains($"/release-group/{ForwardGroupMbid}", StringComparison.Ordinal) =>
                    JsonResponse(ReadFixture("release-group-rerecording.json")),
                _ => throw new InvalidOperationException(path)
            };
        });
        using var harness = new ProviderHarness(
            handler,
            ValidOptions(maxReleaseGroupLookups: 1));
        MusicBrainzExternalMetadataProvider provider = harness.Provider;

        ExternalMetadataResult<RecordingLineageResult> result = await provider.FindOriginalsAsync(
            KnownQuery(SelectedRemixMbid),
            CancellationToken.None);

        Assert.Equal(
            1,
            handler.Requests.Count(
                request => request.RequestUri!.AbsolutePath.Contains("/release-group/", StringComparison.Ordinal)));
        Assert.True(result.Value.Candidates[0].ChronologyComplete);
        Assert.Empty(result.Value.Candidates[0].Warnings);
        Assert.True(result.Value.Candidates[1].ChronologyComplete);
        Assert.Equal(
            ["musicbrainz.release_group_context_incomplete"],
            result.Value.Candidates[1].Warnings);
        Assert.True(result.Value.ChronologyComplete);
        Assert.Equal(
            ["musicbrainz.release_group_context_incomplete"],
            result.Value.Warnings);
    }

    [Fact]
    public async Task Release_group_failure_is_context_only_and_never_a_recording_hard_gate()
    {
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path switch
            {
                _ when path.Contains($"/recording/{SelectedRemixMbid}", StringComparison.Ordinal) =>
                    JsonResponse(ReadFixture("recording-remix-of.json")),
                _ when path.Contains($"/recording/{OriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(OriginalMbid, "Original", relations: [])),
                _ when path.StartsWith("/ws/2/release?", StringComparison.Ordinal) =>
                    JsonResponse(SingleReleasePage(
                        OriginalMbid,
                        FirstReleaseMbid,
                        ForwardGroupMbid,
                        "1980")),
                _ when path.Contains("/release-group/", StringComparison.Ordinal) =>
                    JsonResponse("{}", System.Net.HttpStatusCode.InternalServerError),
                _ => throw new InvalidOperationException(path)
            };
        });
        using var harness = new ProviderHarness(handler, ValidOptions());
        MusicBrainzExternalMetadataProvider provider = harness.Provider;

        ExternalMetadataResult<RecordingLineageResult> result = await provider.FindOriginalsAsync(
            KnownQuery(SelectedRemixMbid),
            CancellationToken.None);

        RecordingLineageCandidate candidate = Assert.Single(result.Value.Candidates);
        Assert.True(candidate.ChronologyComplete);
        Assert.Equal(["musicbrainz.release_group_context_incomplete"], candidate.Warnings);
        Assert.True(result.Value.ChronologyComplete);
        Assert.Equal(candidate.Warnings, result.Value.Warnings);
    }
}
