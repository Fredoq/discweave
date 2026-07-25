using System.Text.Json.Nodes;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzLineageMappingTests
{
    [Theory]
    [InlineData("Selected (Remix)")]
    [InlineData("Selected (Edit)")]
    public async Task Title_suffix_without_supported_relation_does_not_create_a_candidate(
        string title)
    {
        var handler = new CapturingHandler(
            (_, _) => JsonResponse(RecordingDetail(SelectedRemixMbid, title, relations: [])));
        using var harness = new ProviderHarness(handler, ValidOptions());
        MusicBrainzExternalMetadataProvider provider = harness.Provider;

        ExternalMetadataResult<RecordingLineageResult> result = await provider.FindOriginalsAsync(
            new RecordingLineageQuery
            {
                Title = title,
                Artists = ["Selected Artist"],
                KnownRecording = Source("recording", SelectedRemixMbid)
            },
            CancellationToken.None);

        Assert.Empty(result.Value.Candidates);
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task Cover_attribute_name_without_official_uuid_does_not_exclude_candidate()
    {
        JsonObject nameOnlyWork = WorkRelation(WorkMbid);
        nameOnlyWork["attributes"] = new JsonArray("cover");
        string target = RecordingDetail(
            OriginalMbid,
            "Name-Only Cover",
            [nameOnlyWork]);
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path switch
            {
                _ when path.Contains($"/recording/{SelectedRemixMbid}", StringComparison.Ordinal) =>
                    JsonResponse(ReadFixture("recording-remix-of.json")),
                _ when path.Contains($"/recording/{OriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(target),
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

        RecordingLineageCandidate candidate = Assert.Single(result.Value.Candidates);
        Assert.False(Assert.Single(candidate.WorkEvidence).ExplicitCover);
    }

    [Fact]
    public async Task Unrelated_forward_release_group_relation_does_not_mark_rerecording_context()
    {
        string unrelatedGroup = new JsonObject
        {
            ["id"] = ForwardGroupMbid,
            ["title"] = "Group",
            ["relations"] = new JsonArray
            {
                new JsonObject
                {
                    ["type-id"] = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                    ["type"] = "re-recording of",
                    ["direction"] = "forward",
                    ["target-type"] = "release-group",
                    ["release-group"] = new JsonObject
                    {
                        ["id"] = ReverseGroupMbid,
                        ["title"] = "Other Group"
                    }
                }
            }
        }.ToJsonString();
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
                _ when path.Contains($"/release-group/{ForwardGroupMbid}", StringComparison.Ordinal) =>
                    JsonResponse(unrelatedGroup),
                _ => throw new InvalidOperationException(path)
            };
        });
        using var harness = new ProviderHarness(handler, ValidOptions());
        MusicBrainzExternalMetadataProvider provider = harness.Provider;

        ExternalMetadataResult<RecordingLineageResult> result = await provider.FindOriginalsAsync(
            KnownQuery(SelectedRemixMbid),
            CancellationToken.None);

        RecordingReleaseRoute route =
            Assert.Single(Assert.Single(result.Value.Candidates).ReleaseRoutes);
        Assert.False(route.ReleaseGroupRerecordingContext);
    }

    [Fact]
    public async Task Equal_score_and_kind_targets_are_ordered_by_target_mbid()
    {
        string source = RecordingDetail(
            SelectedRemixMbid,
            "Selected",
            [
                RecordingRelation("remix", "forward", OriginalMbid),
                RecordingRelation("remix", "forward", OtherOriginalMbid)
            ]);
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path switch
            {
                _ when path.Contains($"/recording/{SelectedRemixMbid}", StringComparison.Ordinal) =>
                    JsonResponse(source),
                _ when path.Contains($"/recording/{OtherOriginalMbid}", StringComparison.Ordinal) =>
                    JsonResponse(RecordingDetail(OtherOriginalMbid, "Lower MBID", relations: [])),
                _ when path.StartsWith("/ws/2/release?", StringComparison.Ordinal) =>
                    JsonResponse(EmptyReleasePage()),
                _ => throw new InvalidOperationException(path)
            };
        });
        using var harness = new ProviderHarness(
            handler,
            ValidOptions(maxLineageCandidates: 1, maxReleaseGroupLookups: 0));
        MusicBrainzExternalMetadataProvider provider = harness.Provider;

        ExternalMetadataResult<RecordingLineageResult> result = await provider.FindOriginalsAsync(
            KnownQuery(SelectedRemixMbid),
            CancellationToken.None);

        Assert.Equal(
            OtherOriginalMbid,
            Assert.Single(result.Value.Candidates).RecordingSource.ExternalId);
        Assert.Contains("musicbrainz.lineage_target_limit_reached", result.Value.Warnings);
        Assert.DoesNotContain(
            handler.Requests,
            request => request.RequestUri!.AbsolutePath.EndsWith(
                OriginalMbid,
                StringComparison.Ordinal));
    }
}
