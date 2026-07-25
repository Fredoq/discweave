using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzLineageMappingTests
{
    [Fact]
    public async Task A_forward_remix_uses_target_detail_and_maps_directed_lineage()
    {
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path switch
            {
                _ when path.Contains($"/recording/{SelectedRemixMbid}", StringComparison.Ordinal) =>
                    JsonResponse(ReadFixture("recording-remix-of.json")),
                _ when path.Contains($"/recording/{OriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(ReadFixture("recording-detail.json")),
                _ when path.StartsWith("/ws/2/release?", StringComparison.Ordinal) =>
                    JsonResponse(SingleReleasePage(
                        OriginalMbid,
                        FirstReleaseMbid,
                        ForwardGroupMbid,
                        "1980-02-03",
                        includeDiscogsRelation: true)),
                _ when path.Contains($"/release-group/{ForwardGroupMbid}", StringComparison.Ordinal) =>
                    JsonResponse(ReadFixture("release-group-rerecording.json")),
                _ => throw new InvalidOperationException(path)
            };
        });
        using var harness = new ProviderHarness(handler, ValidOptions());
        MusicBrainzExternalMetadataProvider provider = harness.Provider;
        _ = Assert.IsAssignableFrom<IRecordingLineageProvider>(provider);

        ExternalMetadataResult<RecordingLineageResult> result = await provider.FindOriginalsAsync(
            KnownQuery(SelectedRemixMbid),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(SelectedRemixMbid, result.Value.SelectedRecording!.ExternalId);
        RecordingLineageCandidate candidate = Assert.Single(result.Value.Candidates);
        Assert.Equal(OriginalMbid, candidate.RecordingSource.ExternalId);
        Assert.Equal("First Recording", candidate.Title);
        Assert.Equal(["Artist One"], candidate.Artists);
        Assert.Equal(TimeSpan.FromSeconds(181), candidate.Duration);
        RecordingLineageRelation relation = Assert.Single(candidate.Relations);
        Assert.Equal(RecordingLineageRelationKind.RemixOf, relation.Kind);
        Assert.Equal(RecordingLineageDirection.SelectedToCandidate, relation.Direction);
        Assert.Equal(SelectedRemixMbid, relation.SelectedRecordingMbid);
        Assert.Equal(OriginalMbid, relation.CandidateRecordingMbid);
        RecordingWorkEvidence work = Assert.Single(candidate.WorkEvidence);
        Assert.Equal(WorkMbid, work.WorkMbid);
        Assert.False(work.ExplicitCover);
        RecordingReleaseRoute route = Assert.Single(candidate.ReleaseRoutes);
        Assert.Equal(new ProviderPartialDate { Year = 1980, Month = 2, Day = 3 }, route.Date);
        Assert.Equal("1", route.MediumPosition);
        Assert.Equal(FirstTrackMbid, route.MusicBrainzTrackMbid);
        Assert.True(route.ReleaseGroupRerecordingContext);
        Assert.Equal("12345", Assert.Single(route.RelatedReleaseSources).ExternalId);
        Assert.True(candidate.ChronologyComplete);
        Assert.True(result.Value.ChronologyComplete);
        Assert.Empty(candidate.Warnings);
        Assert.Empty(result.Value.Warnings);
    }

    [Fact]
    public async Task A_forward_edit_maps_version_lineage_without_using_the_title_suffix()
    {
        string target = RecordingDetail(OriginalMbid, "Unlabelled Original", relations: []);
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path switch
            {
                _ when path.Contains($"/recording/{SelectedEditMbid}", StringComparison.Ordinal) =>
                    JsonResponse(ReadFixture("recording-edit-of.json")),
                _ when path.Contains($"/recording/{OriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(target),
                _ when path.StartsWith("/ws/2/release?", StringComparison.Ordinal) =>
                    JsonResponse(EmptyReleasePage()),
                _ => throw new InvalidOperationException(path)
            };
        });
        using var harness = new ProviderHarness(handler, ValidOptions(maxReleaseGroupLookups: 0));
        MusicBrainzExternalMetadataProvider provider = harness.Provider;

        ExternalMetadataResult<RecordingLineageResult> result = await provider.FindOriginalsAsync(
            KnownQuery(SelectedEditMbid),
            CancellationToken.None);

        RecordingLineageCandidate candidate = Assert.Single(result.Value.Candidates);
        Assert.Equal(
            RecordingLineageRelationKind.EditOf,
            Assert.Single(candidate.Relations).Kind);
        Assert.True(candidate.ChronologyComplete);
    }

    [Fact]
    public async Task A_backward_recording_relation_excludes_the_derived_target()
    {
        string backward = ReadFixture("recording-remix-of.json")
            .Replace("\"direction\": \"forward\"", "\"direction\": \"backward\"", StringComparison.Ordinal);
        var handler = new CapturingHandler(
            (_, _) => JsonResponse(backward));
        using var harness = new ProviderHarness(handler, ValidOptions());
        MusicBrainzExternalMetadataProvider provider = harness.Provider;

        ExternalMetadataResult<RecordingLineageResult> result = await provider.FindOriginalsAsync(
            KnownQuery(SelectedRemixMbid),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value.Candidates);
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task Explicit_cover_work_evidence_excludes_the_candidate()
    {
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path switch
            {
                _ when path.Contains($"/recording/{SelectedRemixMbid}", StringComparison.Ordinal) =>
                    JsonResponse(ReadFixture("recording-remix-of.json")),
                _ when path.Contains($"/recording/{OriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(ReadFixture("recording-cover.json")),
                _ => throw new InvalidOperationException(path)
            };
        });
        using var harness = new ProviderHarness(handler, ValidOptions());
        MusicBrainzExternalMetadataProvider provider = harness.Provider;

        ExternalMetadataResult<RecordingLineageResult> result = await provider.FindOriginalsAsync(
            KnownQuery(SelectedRemixMbid),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value.Candidates);
        Assert.DoesNotContain(
            handler.Requests,
            request => request.RequestUri!.AbsolutePath == "/ws/2/release");
    }

    [Fact]
    public async Task Same_work_or_missing_relations_do_not_create_lineage_candidates()
    {
        string sameWorkOnly = RecordingDetail(
            SelectedRemixMbid,
            "Same Work",
            relations:
            [
                WorkRelation(WorkMbid)
            ]);
        var handler = new CapturingHandler((_, _) => JsonResponse(sameWorkOnly));
        using var harness = new ProviderHarness(handler, ValidOptions());
        MusicBrainzExternalMetadataProvider provider = harness.Provider;

        ExternalMetadataResult<RecordingLineageResult> withWork = await provider.FindOriginalsAsync(
            KnownQuery(SelectedRemixMbid),
            CancellationToken.None);

        Assert.Empty(withWork.Value.Candidates);

        string withoutRelations = RecordingDetail(SelectedEditMbid, "No Relations", relations: []);
        var secondHandler = new CapturingHandler((_, _) => JsonResponse(withoutRelations));
        using var secondHarness = new ProviderHarness(secondHandler, ValidOptions());
        MusicBrainzExternalMetadataProvider secondProvider = secondHarness.Provider;

        ExternalMetadataResult<RecordingLineageResult> missing = await secondProvider.FindOriginalsAsync(
            KnownQuery(SelectedEditMbid),
            CancellationToken.None);

        Assert.Empty(missing.Value.Candidates);
    }
}
