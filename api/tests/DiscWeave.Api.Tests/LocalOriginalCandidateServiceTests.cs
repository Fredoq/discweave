using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed partial class LocalOriginalCandidateServiceTests
    : IClassFixture<SqliteFixture>
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Missing_and_foreign_sources_are_indistinguishable(bool foreign)
    {
        var collectionId = CollectionId.New();
        var sourceTrackId = TrackId.New();
        LocalOriginalCandidateSnapshot snapshot = foreign
            ? Snapshot(
                collectionId,
                Source(collectionId: CollectionId.New(), trackId: sourceTrackId))
            : NotFoundSnapshot();
        LocalOriginalCandidateService service = CreateService(snapshot);

        LocalOriginalCandidateResult result = await service.FindAsync(
            collectionId,
            sourceTrackId,
            CancellationToken.None);

        Assert.Equal(LocalOriginalCandidateStatus.SourceNotFound, result.Status);
        Assert.Equal(sourceTrackId, result.SourceTrackId);
        Assert.Null(result.Source);
        Assert.Empty(result.Candidates);
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task Original_or_stacked_source_is_not_eligible(
        bool isOriginal,
        bool isStacked)
    {
        var collectionId = CollectionId.New();
        LocalOriginalCandidateSnapshot.SourceTrackFact source =
            Source(collectionId: collectionId, isOriginal: isOriginal);
        LocalOriginalCandidateSnapshot snapshot = Snapshot(collectionId, source);
        if (isStacked)
        {
            var rootId = TrackId.New();
            snapshot = snapshot with
            {
                StackTracks =
                [
                    StackTrack(source),
                    StackTrack(collectionId, rootId, "Pulse", true)
                ],
                StackRelations =
                [
                    StackRelation(collectionId, source.TrackId, rootId, "remixOf")
                ]
            };
        }

        LocalOriginalCandidateResult result = await CreateService(snapshot).FindAsync(
            collectionId,
            source.TrackId,
            CancellationToken.None);

        Assert.Equal(LocalOriginalCandidateStatus.SourceNotEligible, result.Status);
        Assert.NotNull(result.Source);
        Assert.Empty(result.Candidates);
    }

    [Fact]
    public async Task Existing_root_candidate_preserves_members_and_needs_no_promotion()
    {
        var collectionId = CollectionId.New();
        LocalOriginalCandidateSnapshot.SourceTrackFact source = Source(collectionId);
        LocalOriginalCandidateSnapshot.CandidateTrackFact candidate =
            Candidate(collectionId, title: "Pulse", isOriginal: true, versionYear: 1999);
        var directMemberId = TrackId.New();
        var nestedMemberId = TrackId.New();
        LocalOriginalCandidateSnapshot snapshot = CandidateSnapshot(
            collectionId,
            source,
            candidate) with
        {
            StackTracks =
            [
                StackTrack(source),
                StackTrack(candidate),
                StackTrack(collectionId, directMemberId, "Pulse (Edit)", false),
                StackTrack(collectionId, nestedMemberId, "Pulse (Radio Edit)", false)
            ],
            StackRelations =
            [
                StackRelation(collectionId, directMemberId, candidate.TrackId, "versionOf"),
                StackRelation(collectionId, nestedMemberId, directMemberId, "versionOf")
            ]
        };

        LocalOriginalCandidateResult result = await CreateService(snapshot).FindAsync(
            collectionId,
            source.TrackId,
            CancellationToken.None);

        LocalOriginalCandidate local = Assert.Single(result.Candidates);
        Assert.Equal(LocalOriginalCandidateStatus.Success, result.Status);
        Assert.True(local.IsExistingRoot);
        Assert.Equal(2, local.MemberCount);
        Assert.False(local.RequiresPromotion);
        Assert.Equal(candidate.VersionYear, local.VersionYear);
    }

    [Fact]
    public async Task Standalone_candidate_requires_promotion_and_uses_enabled_marker_type()
    {
        var collectionId = CollectionId.New();
        LocalOriginalCandidateSnapshot.SourceTrackFact source = Source(collectionId);
        LocalOriginalCandidateSnapshot.CandidateTrackFact candidate =
            Candidate(collectionId, title: "Pulse");
        LocalOriginalCandidateSnapshot snapshot = CandidateSnapshot(
            collectionId,
            source,
            candidate);

        LocalOriginalCandidateResult result = await CreateService(snapshot).FindAsync(
            collectionId,
            source.TrackId,
            CancellationToken.None);

        LocalOriginalCandidate local = Assert.Single(result.Candidates);
        Assert.False(local.IsExistingRoot);
        Assert.Equal(0, local.MemberCount);
        Assert.True(local.RequiresPromotion);
        Assert.Equal("remixOf", local.SuggestedRelationTypeCode);
        Assert.Equal(candidate.TrackId, local.LocalTrackId);
    }

    [Fact]
    public async Task Foreign_self_member_cyclic_and_incompatible_candidates_are_excluded()
    {
        var collectionId = CollectionId.New();
        LocalOriginalCandidateSnapshot.SourceTrackFact source = Source(collectionId);
        LocalOriginalCandidateSnapshot.CandidateTrackFact eligible = Candidate(collectionId);
        LocalOriginalCandidateSnapshot.CandidateTrackFact foreign =
            Candidate(CollectionId.New());
        LocalOriginalCandidateSnapshot.CandidateTrackFact self =
            Candidate(collectionId, trackId: source.TrackId);
        LocalOriginalCandidateSnapshot.CandidateTrackFact member = Candidate(collectionId);
        LocalOriginalCandidateSnapshot.CandidateTrackFact cyclic = Candidate(collectionId);
        LocalOriginalCandidateSnapshot.CandidateTrackFact incompatible =
            Candidate(collectionId, isOriginal: false);
        var rootId = TrackId.New();
        var cycleMemberId = TrackId.New();
        var incompatibleMemberId = TrackId.New();
        LocalOriginalCandidateSnapshot snapshot = CandidateSnapshot(
            collectionId,
            source,
            eligible,
            foreign,
            self,
            member,
            cyclic,
            incompatible) with
        {
            StackTracks =
            [
                StackTrack(source),
                StackTrack(eligible),
                StackTrack(member),
                StackTrack(cyclic),
                StackTrack(incompatible),
                StackTrack(collectionId, rootId, "Pulse", true),
                StackTrack(collectionId, cycleMemberId, "Pulse (Cycle)", false),
                StackTrack(collectionId, incompatibleMemberId, "Pulse (Edit)", false)
            ],
            StackRelations =
            [
                StackRelation(collectionId, member.TrackId, rootId, "versionOf"),
                StackRelation(collectionId, cycleMemberId, cyclic.TrackId, "versionOf"),
                StackRelation(collectionId, cyclic.TrackId, cycleMemberId, "versionOf"),
                StackRelation(
                    collectionId,
                    incompatibleMemberId,
                    incompatible.TrackId,
                    "versionOf")
            ]
        };

        LocalOriginalCandidateResult result = await CreateService(snapshot).FindAsync(
            collectionId,
            source.TrackId,
            CancellationToken.None);

        LocalOriginalCandidate local = Assert.Single(result.Candidates);
        Assert.Equal(eligible.TrackId, local.LocalTrackId);
    }

    [Fact]
    public async Task Exact_MusicBrainz_recording_identity_is_not_ranked_as_a_candidate()
    {
        var collectionId = CollectionId.New();
        const string recordingId = "95f4d6df-9ea4-4b25-bc02-59f84cc1c407";
        LocalOriginalCandidateSnapshot.SourceTrackFact source =
            Source(collectionId, recordingSource: Recording(recordingId));
        LocalOriginalCandidateSnapshot.CandidateTrackFact sameRecording =
            Candidate(collectionId, recordingSource: Recording(recordingId));
        LocalOriginalCandidateSnapshot.CandidateTrackFact otherRecording =
            Candidate(collectionId, recordingSource: Recording(
                "b8d1b1a2-3457-49a4-912e-3d68b58bd75b"));
        LocalOriginalCandidateSnapshot snapshot = CandidateSnapshot(
            collectionId,
            source,
            sameRecording,
            otherRecording);

        LocalOriginalCandidateResult result = await CreateService(snapshot).FindAsync(
            collectionId,
            source.TrackId,
            CancellationToken.None);

        LocalOriginalCandidate local = Assert.Single(result.Candidates);
        Assert.Equal(otherRecording.TrackId, local.LocalTrackId);
        Assert.Equal(otherRecording.RecordingSource, local.RecordingSource);
    }

    [Fact]
    public async Task Disabled_parser_type_is_not_suggested_but_candidate_is_still_ranked()
    {
        var collectionId = CollectionId.New();
        LocalOriginalCandidateSnapshot.SourceTrackFact source = Source(collectionId);
        LocalOriginalCandidateSnapshot snapshot = CandidateSnapshot(
            collectionId,
            source,
            Candidate(collectionId)) with
        {
            EnabledStackRelationTypeCodes = ["versionOf"]
        };

        LocalOriginalCandidateResult result = await CreateService(snapshot).FindAsync(
            collectionId,
            source.TrackId,
            CancellationToken.None);

        LocalOriginalCandidate local = Assert.Single(result.Candidates);
        Assert.Null(local.SuggestedRelationTypeCode);
        Assert.Contains(
            local.Ranked.SupportingEvidence,
            evidence => evidence.Code == OriginalCandidateEvidenceCode.VersionMarker);
    }

    [Fact]
    public async Task Remixer_credit_supports_only_remix_marker_candidates()
    {
        var collectionId = CollectionId.New();
        LocalOriginalCandidateSnapshot.SourceTrackFact source = Source(collectionId);
        LocalOriginalCandidateSnapshot.CandidateTrackFact candidate = Candidate(collectionId);
        LocalOriginalCandidateSnapshot snapshot = CandidateSnapshot(
            collectionId,
            source,
            candidate) with
        {
            Credits =
            [
                Credit(collectionId, source.TrackId, "remixer", "Distinct Remixer")
            ]
        };

        LocalOriginalCandidateResult remixResult = await CreateService(snapshot).FindAsync(
            collectionId,
            source.TrackId,
            CancellationToken.None);
        LocalOriginalCandidateResult versionResult = await CreateService(
            snapshot with
            {
                ParserRules =
                [
                    ParserRule("versionOf", "Remix")
                ],
                EnabledStackRelationTypeCodes = ["versionOf"]
            }).FindAsync(collectionId, source.TrackId, CancellationToken.None);

        Assert.Contains(
            Assert.Single(remixResult.Candidates).Ranked.SupportingEvidence,
            evidence => evidence.Code == OriginalCandidateEvidenceCode.CreditsSupport);
        Assert.DoesNotContain(
            Assert.Single(versionResult.Candidates).Ranked.SupportingEvidence,
            evidence => evidence.Code == OriginalCandidateEvidenceCode.CreditsSupport);
    }
}
