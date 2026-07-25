using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalTrackExternalCandidateEndpointTests
{
    [Fact(DisplayName = "Exact Recording identity merges external routes and attaches the smallest Medium local Track")]
    public async Task Exact_Recording_identity_merges_external_routes_and_attaches_the_smallest_Medium_local_Track()
    {
        var selectedId = Guid.Parse(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var candidateId = Guid.Parse(
            "11111111-1111-1111-1111-111111111111");
        var largerLocalId = Guid.Parse(
            "ffffffff-ffff-ffff-ffff-ffffffffffff");
        var smallerLocalId = Guid.Parse(
            "00000000-0000-0000-0000-000000000001");
        var titleOnlyLocalId = Guid.Parse(
            "00000000-0000-0000-0000-000000000002");
        LocalOriginalCandidate larger = Candidate(
            largerLocalId,
            OriginalCandidateConfidence.Medium) with
        {
            RecordingSource = RecordingSource(candidateId)
        };
        LocalOriginalCandidate smaller = Candidate(
            smallerLocalId,
            OriginalCandidateConfidence.Medium) with
        {
            RecordingSource = RecordingSource(candidateId)
        };
        LocalOriginalCandidate titleOnly = Candidate(
            titleOnlyLocalId,
            OriginalCandidateConfidence.Medium);
        LocalOriginalCandidateResult local = EmptyLocalResult() with
        {
            Candidates = [larger, titleOnly, smaller]
        };
        RecordingLineageCandidate first = LineageCandidate(
            candidateId,
            [Relation(selectedId, candidateId)],
            [Route(
                Guid.Parse("22222222-2222-2222-2222-222222222222"),
                1983)]);
        RecordingLineageCandidate second = LineageCandidate(
            candidateId,
            [
                Relation(
                    selectedId,
                    candidateId,
                    RecordingLineageRelationKind.EditOf)
            ],
            [Route(
                Guid.Parse("33333333-3333-3333-3333-333333333333"),
                1984)]);
        var provider = new FakeRecordingLineageProvider
        {
            Result = new ExternalMetadataResult<RecordingLineageResult>(
                LineageResult([second, first], RecordingSource(selectedId)))
        };

        ExternalOriginalCandidateResult result = await CreateService(
            local,
            provider).FindAsync(
                CollectionId.New(),
                local.SourceTrackId,
                null,
                CancellationToken.None);

        ExternalOriginalCandidate candidate =
            Assert.Single(result.Candidates);
        Assert.Equal(new TrackId(smallerLocalId), candidate.LocalTrackId);
        Assert.Equal("remixOf", candidate.SuggestedRelationTypeCode);
        Assert.Equal(2, candidate.ReleaseRoutes.Count);
        Assert.Equal(3, result.Local.Candidates.Count);
        Assert.Contains(
            result.Local.Candidates,
            item => item.LocalTrackId == new TrackId(titleOnlyLocalId));
    }

    [Fact(DisplayName = "Similar local metadata without exact Recording identity never merges")]
    public async Task Similar_local_metadata_without_exact_Recording_identity_never_merges()
    {
        var selectedId = Guid.Parse(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var candidateId = Guid.Parse(
            "11111111-1111-1111-1111-111111111111");
        LocalOriginalCandidateResult local = EmptyLocalResult() with
        {
            Candidates =
            [
                Candidate(
                    Guid.Parse("00000000-0000-0000-0000-000000000001"),
                    OriginalCandidateConfidence.Medium)
            ]
        };
        var provider = new FakeRecordingLineageProvider
        {
            Result = new ExternalMetadataResult<RecordingLineageResult>(
                LineageResult(
                    [
                        LineageCandidate(
                            candidateId,
                            [Relation(selectedId, candidateId)])
                    ],
                    RecordingSource(selectedId)))
        };

        ExternalOriginalCandidateResult result = await CreateService(
            local,
            provider).FindAsync(
                CollectionId.New(),
                local.SourceTrackId,
                null,
                CancellationToken.None);

        Assert.Null(Assert.Single(result.Candidates).LocalTrackId);
        _ = Assert.Single(result.Local.Candidates);
    }

    [Fact(DisplayName = "Ranker ordering is stable under shuffled provider candidates")]
    public async Task Ranker_ordering_is_stable_under_shuffled_provider_candidates()
    {
        var selectedId = Guid.Parse(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var lowerId = Guid.Parse(
            "11111111-1111-1111-1111-111111111111");
        var higherId = Guid.Parse(
            "22222222-2222-2222-2222-222222222222");
        RecordingLineageCandidate lower = LineageCandidate(
            lowerId,
            [Relation(selectedId, lowerId)]);
        RecordingLineageCandidate higher = LineageCandidate(
            higherId,
            [Relation(selectedId, higherId)]);
        LocalOriginalCandidateResult local = EmptyLocalResult();

        string[][] orders = [];
        RecordingLineageCandidate[][] permutations =
        [
            [higher, lower],
            [lower, higher]
        ];
        foreach (RecordingLineageCandidate[] candidates in permutations)
        {
            var provider = new FakeRecordingLineageProvider
            {
                Result = new ExternalMetadataResult<RecordingLineageResult>(
                    LineageResult(candidates, RecordingSource(selectedId)))
            };
            ExternalOriginalCandidateResult result = await CreateService(
                local,
                provider).FindAsync(
                    CollectionId.New(),
                    local.SourceTrackId,
                    null,
                    CancellationToken.None);
            orders =
            [
                .. orders,
                [.. result.Candidates.Select(candidate => candidate.CandidateKey)]
            ];
        }

        Assert.Equal(orders[0], orders[1]);
        Assert.Equal(
            OriginalCandidateKey.ForMusicBrainzRecording(lowerId),
            orders[0][0]);
    }
}
