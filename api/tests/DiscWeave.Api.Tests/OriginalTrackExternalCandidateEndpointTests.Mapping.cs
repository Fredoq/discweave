using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Api.Features.Tracks;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalTrackExternalCandidateEndpointTests
{
    [Fact(DisplayName = "Forward lineage maps through the shared ranker without hiding contradictions")]
    public async Task Forward_lineage_maps_through_the_shared_ranker_without_hiding_contradictions()
    {
        var selectedId = Guid.Parse(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var candidateId = Guid.Parse(
            "11111111-1111-1111-1111-111111111111");
        RecordingReleaseRoute route = Route(
            Guid.Parse("22222222-2222-2222-2222-222222222222"),
            1983,
            3,
            7,
            rerecordingContext: true);
        RecordingLineageCandidate lineageCandidate = LineageCandidate(
            candidateId,
            [Relation(selectedId, candidateId)],
            [route],
            warnings: ["candidate.z", "candidate.a"],
            durationSeconds: 300);
        var provider = new FakeRecordingLineageProvider
        {
            Result = new ExternalMetadataResult<RecordingLineageResult>(
                LineageResult(
                    [lineageCandidate],
                    RecordingSource(selectedId),
                    ["result.z", "candidate.a"]))
        };
        LocalOriginalCandidateResult local = EmptyLocalResult();
        ExternalOriginalCandidateService service = CreateService(
            local,
            provider);

        ExternalOriginalCandidateResult result = await service.FindAsync(
            CollectionId.New(),
            local.SourceTrackId,
            null,
            CancellationToken.None);

        ExternalOriginalCandidate candidate =
            Assert.Single(result.Candidates);
        Assert.Equal(
            OriginalCandidateKey.ForMusicBrainzRecording(candidateId),
            candidate.CandidateKey);
        Assert.Equal(OriginalCandidateConfidence.High, candidate.Ranked.Confidence);
        Assert.True(candidate.Ranked.Selectable);
        Assert.Contains(
            candidate.Ranked.SupportingEvidence,
            evidence =>
                evidence.Code == OriginalCandidateEvidenceCode.DirectedLineage
                && evidence.Channel
                    == OriginalCandidateEvidenceChannel.MusicBrainz);
        Assert.Contains(
            candidate.Ranked.Contradictions,
            evidence =>
                evidence.Code
                    == OriginalCandidateEvidenceCode.MaterialDurationMismatch);
        Assert.Equal("remixOf", candidate.SuggestedRelationTypeCode);
        Assert.Equal(route, Assert.Single(candidate.ReleaseRoutes));
        Assert.Equal(
            OriginalCandidateChronology.FromDay(
                new DateOnly(1983, 3, 7),
                complete: true),
            candidate.Ranked.CandidateChronology);
        Assert.True(
            Assert.Single(candidate.ReleaseRoutes)
                .ReleaseGroupRerecordingContext);
        Assert.Equal(
            ["candidate.a", "candidate.z", "result.z"],
            result.Warnings);
    }

    [Fact(DisplayName = "Explicit covers and equal source Recordings never become candidates")]
    public async Task Explicit_covers_and_equal_source_Recordings_never_become_candidates()
    {
        var selectedId = Guid.Parse(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var coverId = Guid.Parse(
            "11111111-1111-1111-1111-111111111111");
        RecordingLineageCandidate equalSource = LineageCandidate(
            selectedId,
            [Relation(selectedId, selectedId)]);
        RecordingLineageCandidate explicitCover = LineageCandidate(
            coverId,
            [Relation(selectedId, coverId)],
            workEvidence:
            [
                new RecordingWorkEvidence
                {
                    WorkMbid = "33333333-3333-3333-3333-333333333333",
                    ExplicitCover = true
                }
            ]);
        var provider = new FakeRecordingLineageProvider
        {
            Result = new ExternalMetadataResult<RecordingLineageResult>(
                LineageResult(
                    [equalSource, explicitCover],
                    RecordingSource(selectedId)))
        };
        LocalOriginalCandidateResult local = EmptyLocalResult() with
        {
            Source = EmptyLocalResult().Source! with
            {
                RecordingSource = RecordingSource(selectedId)
            }
        };

        ExternalOriginalCandidateResult result = await CreateService(
            local,
            provider).FindAsync(
                CollectionId.New(),
                local.SourceTrackId,
                null,
                CancellationToken.None);

        Assert.Empty(result.Candidates);
    }

    [Fact(DisplayName = "The selected source hypothesis is never emitted as a candidate")]
    public async Task Selected_source_hypothesis_is_never_emitted_as_a_candidate()
    {
        var selectedId = Guid.Parse(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var provider = new FakeRecordingLineageProvider
        {
            Result = new ExternalMetadataResult<RecordingLineageResult>(
                LineageResult([], RecordingSource(selectedId)))
        };
        LocalOriginalCandidateResult local = EmptyLocalResult();

        ExternalOriginalCandidateResult result = await CreateService(
            local,
            provider).FindAsync(
                CollectionId.New(),
                local.SourceTrackId,
                null,
                CancellationToken.None);

        Assert.Empty(result.Candidates);
    }

    [Fact(DisplayName = "Incomplete external chronology remains explicit evidence")]
    public async Task Incomplete_external_chronology_remains_explicit_evidence()
    {
        var selectedId = Guid.Parse(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var candidateId = Guid.Parse(
            "11111111-1111-1111-1111-111111111111");
        var provider = new FakeRecordingLineageProvider
        {
            Result = new ExternalMetadataResult<RecordingLineageResult>(
                LineageResult(
                    [
                        LineageCandidate(
                            candidateId,
                            [Relation(selectedId, candidateId)],
                            [Route(
                                Guid.Parse(
                                    "22222222-2222-2222-2222-222222222222"),
                                1983)],
                            chronologyComplete: false)
                    ],
                    RecordingSource(selectedId)))
        };
        LocalOriginalCandidateResult local = EmptyLocalResult();

        ExternalOriginalCandidateResult result = await CreateService(
            local,
            provider).FindAsync(
                CollectionId.New(),
                local.SourceTrackId,
                null,
                CancellationToken.None);

        ExternalOriginalCandidate candidate =
            Assert.Single(result.Candidates);
        Assert.False(candidate.Ranked.CandidateChronology!.Complete);
        Assert.Contains(
            candidate.Ranked.Contradictions,
            evidence =>
                evidence.Code
                    == OriginalCandidateEvidenceCode.IncompleteChronology);
    }

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
