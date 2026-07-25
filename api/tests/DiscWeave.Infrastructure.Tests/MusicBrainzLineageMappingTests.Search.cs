using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzLineageMappingTests
{
    [Fact]
    public async Task Search_hypotheses_are_inspected_in_score_then_MBID_order_and_never_emitted()
    {
        string search = SearchResponse(
            (SearchSecondMbid, 90, "Second"),
            (SearchFirstMbid, 90, "First"),
            (SearchThirdMbid, 80, "Third"));
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path switch
            {
                _ when path.StartsWith("/ws/2/recording?", StringComparison.Ordinal) =>
                    JsonResponse(search),
                _ when path.Contains($"/recording/{SearchFirstMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(
                        SearchFirstMbid,
                        "First",
                        [RecordingRelation("remix", "forward", OriginalMbid)])),
                _ when path.Contains($"/recording/{SearchSecondMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(SearchSecondMbid, "Second", relations: [])),
                _ when path.Contains($"/recording/{SearchThirdMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(
                        SearchThirdMbid,
                        "Third",
                        [RecordingRelation("edit", "forward", OtherOriginalMbid)])),
                _ when path.Contains($"/recording/{OriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(OriginalMbid, "Original One", relations: [])),
                _ when path.Contains($"/recording/{OtherOriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(OtherOriginalMbid, "Original Two", relations: [])),
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
            SearchQuery(),
            CancellationToken.None);

        Assert.Null(result.Value.SelectedRecording);
        Assert.Equal(
            [OriginalMbid, OtherOriginalMbid],
            result.Value.Candidates.Select(candidate => candidate.RecordingSource.ExternalId));
        Assert.DoesNotContain(
            result.Value.Candidates,
            candidate => candidate.RecordingSource.ExternalId is
                SearchFirstMbid or SearchSecondMbid or SearchThirdMbid);
        Assert.Equal(
            [SearchFirstMbid, SearchSecondMbid, SearchThirdMbid],
            handler.Requests
                .Where(request =>
                    request.RequestUri!.AbsolutePath.StartsWith("/ws/2/recording/", StringComparison.Ordinal))
                .Take(3)
                .Select(request => request.RequestUri!.AbsolutePath.Split('/').Last()));
    }

    [Fact]
    public async Task Multiple_hypotheses_to_one_target_merge_and_retain_every_source_relation()
    {
        string search = SearchResponse(
            (SearchFirstMbid, 95, "First"),
            (SearchSecondMbid, 90, "Second"));
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path switch
            {
                _ when path.StartsWith("/ws/2/recording?", StringComparison.Ordinal) =>
                    JsonResponse(search),
                _ when path.Contains($"/recording/{SearchFirstMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(
                        SearchFirstMbid,
                        "First",
                        [RecordingRelation("remix", "forward", OriginalMbid)])),
                _ when path.Contains($"/recording/{SearchSecondMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(
                        SearchSecondMbid,
                        "Second",
                        [RecordingRelation("edit", "forward", OriginalMbid)])),
                _ when path.Contains($"/recording/{OriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(OriginalMbid, "Merged Original", relations: [])),
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
            SearchQuery(),
            CancellationToken.None);

        RecordingLineageCandidate candidate = Assert.Single(result.Value.Candidates);
        Assert.Equal(
            [SearchFirstMbid, SearchSecondMbid],
            candidate.Relations.Select(relation => relation.SelectedRecordingMbid));
        Assert.Equal(
            [RecordingLineageRelationKind.RemixOf, RecordingLineageRelationKind.EditOf],
            candidate.Relations.Select(relation => relation.Kind));
        Assert.Equal(
            1,
            handler.Requests.Count(
                request => request.RequestUri!.AbsolutePath.EndsWith(OriginalMbid, StringComparison.Ordinal)));
    }

    [Fact]
    public async Task Targets_are_ordered_by_score_kind_and_MBID_then_capped_before_detail_lookup()
    {
        string search = SearchResponse(
            (SearchFirstMbid, 95, "First"),
            (SearchSecondMbid, 90, "Second"));
        string firstDetail = RecordingDetail(
            SearchFirstMbid,
            "First",
            [
                RecordingRelation("edit", "forward", OtherOriginalMbid),
                RecordingRelation("remix", "forward", OriginalMbid)
            ]);
        string secondDetail = RecordingDetail(
            SearchSecondMbid,
            "Second",
            [RecordingRelation("remix", "forward", ThirdOriginalMbid)]);
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path switch
            {
                _ when path.StartsWith("/ws/2/recording?", StringComparison.Ordinal) =>
                    JsonResponse(search),
                _ when path.Contains($"/recording/{SearchFirstMbid}", StringComparison.Ordinal) =>
                    JsonResponse(firstDetail),
                _ when path.Contains($"/recording/{SearchSecondMbid}", StringComparison.Ordinal) =>
                    JsonResponse(secondDetail),
                _ when path.Contains($"/recording/{OriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(OriginalMbid, "First Target", relations: [])),
                _ when path.Contains($"/recording/{OtherOriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(OtherOriginalMbid, "Second Target", relations: [])),
                _ when path.StartsWith("/ws/2/release?", StringComparison.Ordinal) =>
                    JsonResponse(EmptyReleasePage()),
                _ => throw new InvalidOperationException(path)
            };
        });
        using var harness = new ProviderHarness(
            handler,
            ValidOptions(maxLineageCandidates: 2, maxReleaseGroupLookups: 0));
        MusicBrainzExternalMetadataProvider provider = harness.Provider;

        ExternalMetadataResult<RecordingLineageResult> result = await provider.FindOriginalsAsync(
            SearchQuery(),
            CancellationToken.None);

        Assert.Equal(
            [OriginalMbid, OtherOriginalMbid],
            result.Value.Candidates.Select(candidate => candidate.RecordingSource.ExternalId));
        Assert.Contains("musicbrainz.lineage_target_limit_reached", result.Value.Warnings);
        Assert.False(result.Value.ChronologyComplete);
        Assert.DoesNotContain(
            handler.Requests,
            request => request.RequestUri!.AbsolutePath.EndsWith(ThirdOriginalMbid, StringComparison.Ordinal));
    }

    [Fact]
    public async Task A_source_hypothesis_equal_to_its_target_is_deduplication_not_a_candidate()
    {
        string search = SearchResponse((SearchFirstMbid, 100, "First"));
        string detail = RecordingDetail(
            SearchFirstMbid,
            "First",
            [RecordingRelation("remix", "forward", SearchFirstMbid)]);
        var handler = new CapturingHandler((request, _) =>
            request.RequestUri!.AbsolutePath == "/ws/2/recording"
                ? JsonResponse(search)
                : JsonResponse(detail));
        using var harness = new ProviderHarness(handler, ValidOptions());
        MusicBrainzExternalMetadataProvider provider = harness.Provider;

        ExternalMetadataResult<RecordingLineageResult> result = await provider.FindOriginalsAsync(
            SearchQuery(),
            CancellationToken.None);

        Assert.Empty(result.Value.Candidates);
        Assert.Equal(2, handler.CallCount);
    }
}
