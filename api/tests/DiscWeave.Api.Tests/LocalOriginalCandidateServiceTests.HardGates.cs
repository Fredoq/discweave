using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed partial class LocalOriginalCandidateServiceTests
{
    [Fact]
    public async Task Explicit_cover_and_reversed_lineage_candidates_are_excluded()
    {
        var collectionId = CollectionId.New();
        LocalOriginalCandidateSnapshot.SourceTrackFact source =
            Source(collectionId);
        LocalOriginalCandidateSnapshot.CandidateTrackFact eligible =
            Candidate(collectionId);
        LocalOriginalCandidateSnapshot.CandidateTrackFact cover =
            Candidate(collectionId);
        LocalOriginalCandidateSnapshot.CandidateTrackFact reversed =
            Candidate(collectionId);
        LocalOriginalCandidateSnapshot snapshot = CandidateSnapshot(
            collectionId,
            source,
            eligible,
            cover,
            reversed) with
        {
            EnabledStackRelationTypeCodes = ["versionOf"],
            StackRelations =
            [
                StackRelation(
                    collectionId,
                    source.TrackId,
                    cover.TrackId,
                    "coverOf"),
                StackRelation(
                    collectionId,
                    reversed.TrackId,
                    source.TrackId,
                    "remixOf")
            ]
        };

        LocalOriginalCandidateResult result = await CreateService(snapshot)
            .FindAsync(
                collectionId,
                source.TrackId,
                CancellationToken.None);

        LocalOriginalCandidate candidate = Assert.Single(result.Candidates);
        Assert.Equal(eligible.TrackId, candidate.LocalTrackId);
    }

    [Fact]
    public async Task Forward_lineage_is_decisive_even_when_its_type_is_disabled()
    {
        var collectionId = CollectionId.New();
        LocalOriginalCandidateSnapshot.SourceTrackFact source =
            Source(collectionId);
        LocalOriginalCandidateSnapshot.CandidateTrackFact candidate =
            Candidate(collectionId);
        LocalOriginalCandidateSnapshot snapshot = CandidateSnapshot(
            collectionId,
            source,
            candidate) with
        {
            EnabledStackRelationTypeCodes = ["versionOf"],
            StackRelations =
            [
                StackRelation(
                    collectionId,
                    source.TrackId,
                    candidate.TrackId,
                    "remixOf")
            ]
        };

        LocalOriginalCandidateResult result = await CreateService(snapshot)
            .FindAsync(
                collectionId,
                source.TrackId,
                CancellationToken.None);

        LocalOriginalCandidate local = Assert.Single(result.Candidates);
        Assert.Equal(
            OriginalCandidateConfidence.High,
            local.Ranked.Confidence);
        Assert.Contains(
            local.Ranked.SupportingEvidence,
            evidence =>
                evidence.Code == OriginalCandidateEvidenceCode.DirectedLineage);
        Assert.Null(local.SuggestedRelationTypeCode);
    }

    [Fact]
    public async Task Base_to_variant_rules_do_not_parse_a_variant_source()
    {
        var collectionId = CollectionId.New();
        LocalOriginalCandidateSnapshot.SourceTrackFact source =
            Source(collectionId);
        LocalOriginalCandidateSnapshot snapshot = CandidateSnapshot(
            collectionId,
            source,
            Candidate(collectionId)) with
        {
            ParserRules =
            [
                ParserRule("remixOf", "Remix") with
                {
                    Direction =
                        TrackRelationParserRuleDirection.BaseToVariant
                }
            ]
        };

        LocalOriginalCandidateResult result = await CreateService(snapshot)
            .FindAsync(
                collectionId,
                source.TrackId,
                CancellationToken.None);

        Assert.Equal(source.Title, result.Source?.BaseTitle);
        Assert.Empty(result.Candidates);
    }
}
