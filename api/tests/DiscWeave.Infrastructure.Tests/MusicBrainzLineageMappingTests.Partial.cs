using System.Net;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;
using Microsoft.Extensions.Time.Testing;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzLineageMappingTests
{
    [Fact]
    public async Task Mixed_candidates_keep_independent_complete_and_invalid_route_chronology()
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
                    JsonResponse(RecordingDetail(OriginalMbid, "Complete", relations: [])),
                _ when path.Contains($"/recording/{OtherOriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(OtherOriginalMbid, "Partial", relations: [])),
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
                        "1981-04",
                        includeInvalidRow: true)),
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

        Assert.Equal(2, result.Value.Candidates.Count);
        RecordingLineageCandidate complete = result.Value.Candidates[0];
        RecordingLineageCandidate partial = result.Value.Candidates[1];
        Assert.True(complete.ChronologyComplete);
        Assert.Empty(complete.Warnings);
        Assert.Equal(new ProviderPartialDate { Year = 1980 }, Assert.Single(complete.ReleaseRoutes).Date);
        Assert.False(partial.ChronologyComplete);
        Assert.Equal(
            ["musicbrainz.release_chronology_incomplete", "musicbrainz.release_route_invalid"],
            partial.Warnings);
        Assert.Equal(
            new ProviderPartialDate { Year = 1981, Month = 4 },
            Assert.Single(partial.ReleaseRoutes).Date);
        Assert.False(result.Value.ChronologyComplete);
        Assert.Equal(partial.Warnings, result.Value.Warnings);
    }

    [Fact]
    public async Task Candidate_detail_failure_omits_only_that_target_and_preserves_completed_candidates()
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
                    JsonResponse(RecordingDetail(OriginalMbid, "Complete", relations: [])),
                _ when path.Contains($"/recording/{OtherOriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse("{}", HttpStatusCode.InternalServerError),
                _ when path.StartsWith("/ws/2/release?", StringComparison.Ordinal) =>
                    JsonResponse(EmptyReleasePage()),
                _ => throw new InvalidOperationException(path)
            };
        });
        using var harness = new ProviderHarness(
            handler,
            ValidOptions(maxReleaseGroupLookups: 0));
        MusicBrainzExternalMetadataProvider provider = harness.Provider;

        ExternalMetadataResult<RecordingLineageResult> result = await provider.FindOriginalsAsync(
            KnownQuery(SelectedRemixMbid),
            CancellationToken.None);

        Assert.Equal(OriginalMbid, Assert.Single(result.Value.Candidates).RecordingSource.ExternalId);
        Assert.Equal(["musicbrainz.candidate_detail_failed"], result.Value.Warnings);
        Assert.False(result.Value.ChronologyComplete);
    }

    [Fact]
    public async Task Page_limit_preserves_candidate_routes_and_adds_exact_candidate_warnings()
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
                        "1980",
                        reportedTotal: 2)),
                _ when path.Contains($"/release-group/{ForwardGroupMbid}", StringComparison.Ordinal) =>
                    JsonResponse(ReadFixture("release-group-rerecording.json")),
                _ => throw new InvalidOperationException(path)
            };
        });
        using var harness = new ProviderHarness(
            handler,
            ValidOptions(maxReleasePages: 1));
        MusicBrainzExternalMetadataProvider provider = harness.Provider;

        ExternalMetadataResult<RecordingLineageResult> result = await provider.FindOriginalsAsync(
            KnownQuery(SelectedRemixMbid),
            CancellationToken.None);

        RecordingLineageCandidate candidate = Assert.Single(result.Value.Candidates);
        _ = Assert.Single(candidate.ReleaseRoutes);
        Assert.False(candidate.ChronologyComplete);
        Assert.Equal(
            ["musicbrainz.release_chronology_incomplete", "musicbrainz.release_page_limit_reached"],
            candidate.Warnings);
        Assert.Equal(candidate.Warnings, result.Value.Warnings);
    }

    [Fact]
    public async Task Request_budget_exhaustion_before_a_candidate_is_result_scoped_only()
    {
        var handler = new CapturingHandler(
            (_, _) => JsonResponse(ReadFixture("recording-remix-of.json")));
        using var harness = new ProviderHarness(
            handler,
            ValidOptions(maxRequestsPerOperation: 1));
        MusicBrainzExternalMetadataProvider provider = harness.Provider;

        ExternalMetadataResult<RecordingLineageResult> result = await provider.FindOriginalsAsync(
            KnownQuery(SelectedRemixMbid),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value.Candidates);
        Assert.False(result.Value.ChronologyComplete);
        Assert.Equal(["musicbrainz.operation_budget_exhausted"], result.Value.Warnings);
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task Request_budget_exhaustion_preserves_completed_candidates_without_retroactive_warnings()
    {
        string source = RecordingDetail(
            SelectedRemixMbid,
            "Selected",
            [
                RecordingRelation("remix", "forward", OriginalMbid),
                RecordingRelation("edit", "forward", OtherOriginalMbid),
                RecordingRelation("edit", "forward", ThirdOriginalMbid)
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
                _ when path.Contains($"/recording/{ThirdOriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(ThirdOriginalMbid, "Second", relations: [])),
                _ when path.StartsWith("/ws/2/release?", StringComparison.Ordinal) =>
                    JsonResponse(EmptyReleasePage()),
                _ => throw new InvalidOperationException(path)
            };
        });
        using var harness = new ProviderHarness(
            handler,
            ValidOptions(
                maxRequestsPerOperation: 5,
                maxLineageCandidates: 3,
                maxReleaseGroupLookups: 0));
        MusicBrainzExternalMetadataProvider provider = harness.Provider;

        ExternalMetadataResult<RecordingLineageResult> result = await provider.FindOriginalsAsync(
            KnownQuery(SelectedRemixMbid),
            CancellationToken.None);

        Assert.Equal(
            [OriginalMbid, ThirdOriginalMbid],
            result.Value.Candidates.Select(candidate => candidate.RecordingSource.ExternalId));
        Assert.All(result.Value.Candidates, candidate =>
        {
            Assert.True(candidate.ChronologyComplete);
            Assert.Empty(candidate.Warnings);
        });
        Assert.False(result.Value.ChronologyComplete);
        Assert.Equal(["musicbrainz.operation_budget_exhausted"], result.Value.Warnings);
        Assert.Equal(5, handler.CallCount);
    }

    [Fact]
    public async Task Deadline_during_candidate_browse_preserves_the_candidate_and_scopes_the_warning()
    {
        var timeProvider = new FakeTimeProvider();
        var blockedBrowse = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var handler = new CapturingHandler(async (request, cancellationToken) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            if (path.Contains($"/recording/{SelectedRemixMbid}", StringComparison.Ordinal))
            {
                return await JsonResponse(ReadFixture("recording-remix-of.json")).ConfigureAwait(false);
            }

            if (path.Contains($"/recording/{OriginalMbid}", StringComparison.Ordinal))
            {
                return await JsonResponse(
                    RecordingDetail(OriginalMbid, "Original", relations: [])).ConfigureAwait(false);
            }

            _ = blockedBrowse.TrySetResult();
            await Task.Delay(Timeout.InfiniteTimeSpan, timeProvider, cancellationToken);
            throw new InvalidOperationException("The operation deadline should cancel the browse.");
        });
        using var harness = new ProviderHarness(
            handler,
            ValidOptions(operationTimeoutSeconds: 10, maxReleaseGroupLookups: 0),
            timeProvider);
        MusicBrainzExternalMetadataProvider provider = harness.Provider;

        Task<ExternalMetadataResult<RecordingLineageResult>> operation = provider.FindOriginalsAsync(
            KnownQuery(SelectedRemixMbid),
            CancellationToken.None);
        await blockedBrowse.Task.WaitAsync(TimeSpan.FromSeconds(2));
        timeProvider.Advance(TimeSpan.FromSeconds(10));
        ExternalMetadataResult<RecordingLineageResult> result =
            await operation.WaitAsync(TimeSpan.FromSeconds(2));

        RecordingLineageCandidate candidate = Assert.Single(result.Value.Candidates);
        Assert.False(candidate.ChronologyComplete);
        Assert.Equal(
            ["musicbrainz.operation_budget_exhausted", "musicbrainz.release_chronology_incomplete"],
            candidate.Warnings);
        Assert.Equal(candidate.Warnings, result.Value.Warnings);
    }
}
