using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Api.Features.Tracks;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalTrackExternalCandidateEndpointTests
{
    [Fact(DisplayName = "Only a matching forward relation creates and attaches a candidate")]
    public async Task Only_a_matching_forward_relation_creates_and_attaches_a_candidate()
    {
        var selectedId = Guid.Parse(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var relationlessId = Guid.Parse(
            "11111111-1111-1111-1111-111111111111");
        var wrongTargetId = Guid.Parse(
            "22222222-2222-2222-2222-222222222222");
        var reversedId = Guid.Parse(
            "33333333-3333-3333-3333-333333333333");
        var otherId = Guid.Parse(
            "44444444-4444-4444-4444-444444444444");
        var provider = new FakeRecordingLineageProvider
        {
            Result = new ExternalMetadataResult<RecordingLineageResult>(
                LineageResult(
                    [
                        LineageCandidate(relationlessId),
                        LineageCandidate(
                            wrongTargetId,
                            [Relation(selectedId, otherId)]),
                        LineageCandidate(
                            reversedId,
                            [
                                Relation(
                                    selectedId,
                                    reversedId,
                                    direction: RecordingLineageDirection
                                        .CandidateToSelected)
                            ])
                    ],
                    RecordingSource(selectedId)))
        };
        LocalOriginalCandidateResult local = EmptyLocalResult() with
        {
            Candidates =
            [
                Candidate(
                    relationlessId,
                    OriginalCandidateConfidence.Medium) with
                {
                    RecordingSource = RecordingSource(relationlessId)
                },
                Candidate(
                    wrongTargetId,
                    OriginalCandidateConfidence.Medium) with
                {
                    RecordingSource = RecordingSource(wrongTargetId)
                },
                Candidate(
                    reversedId,
                    OriginalCandidateConfidence.Medium) with
                {
                    RecordingSource = RecordingSource(reversedId)
                }
            ]
        };
        ExternalOriginalCandidateService service = CreateService(
            local,
            provider);

        ExternalOriginalCandidateResult invalidResult =
            await service.FindAsync(
                CollectionId.New(),
                local.SourceTrackId,
                null,
                CancellationToken.None);

        Assert.Empty(invalidResult.Candidates);
        Assert.Equal(3, invalidResult.Local.Candidates.Count);

        provider.Result = new ExternalMetadataResult<RecordingLineageResult>(
            LineageResult(
                [
                    LineageCandidate(
                        relationlessId,
                        [Relation(selectedId, relationlessId)]),
                    LineageCandidate(
                        wrongTargetId,
                        [Relation(selectedId, otherId)]),
                    LineageCandidate(
                        reversedId,
                        [
                            Relation(
                                selectedId,
                                reversedId,
                                direction: RecordingLineageDirection
                                    .CandidateToSelected)
                        ])
                ],
                RecordingSource(selectedId)));

        ExternalOriginalCandidateResult validResult = await service.FindAsync(
            CollectionId.New(),
            local.SourceTrackId,
            null,
            CancellationToken.None);

        ExternalOriginalCandidate candidate =
            Assert.Single(validResult.Candidates);
        Assert.Equal(
            OriginalCandidateKey.ForMusicBrainzRecording(relationlessId),
            candidate.CandidateKey);
        Assert.Equal(new TrackId(relationlessId), candidate.LocalTrackId);
    }
}
