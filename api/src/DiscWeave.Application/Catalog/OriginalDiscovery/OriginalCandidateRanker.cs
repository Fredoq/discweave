namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public static class OriginalCandidateRanker
{
    public static IReadOnlyList<RankedOriginalCandidate> Rank(
        IReadOnlyCollection<OriginalCandidateInput> inputs)
    {
        ArgumentNullException.ThrowIfNull(inputs);

        RankedOriginalCandidate[] eligible =
        [
            .. inputs
                .Where(input => input.HardGates.Count == 0)
                .Select(CreateRankedCandidate)
        ];

        return
        [
            .. eligible
                .OrderByDescending(candidate => candidate.Confidence)
                .ThenByDescending(candidate =>
                    HasEvidence(candidate.SupportingEvidence, OriginalCandidateEvidenceCode.DirectedLineage))
                .ThenByDescending(candidate => candidate.SupportingEvidence.Count)
                .ThenBy(candidate => candidate.Contradictions.Count)
                .ThenBy(ChronologySortGroup)
                .ThenBy(ChronologyLowerBound)
                .ThenBy(ChronologyUpperBound)
                .ThenBy(candidate => candidate.CandidateKey, StringComparer.Ordinal)
        ];
    }

    private static RankedOriginalCandidate CreateRankedCandidate(OriginalCandidateInput input)
    {
        IReadOnlyList<OriginalCandidateEvidence> supporting =
            SelectEvidence(input.Evidence, OriginalCandidateEvidenceKind.Support);
        IReadOnlyList<OriginalCandidateEvidence> contradictions =
            SelectEvidence(input.Evidence, OriginalCandidateEvidenceKind.Contradiction);
        IReadOnlyList<OriginalCandidateEvidence> missing =
            SelectEvidence(input.Evidence, OriginalCandidateEvidenceKind.Missing);

        return new RankedOriginalCandidate
        {
            CandidateKey = input.CandidateKey,
            Confidence = Classify(supporting, contradictions),
            Selectable = true,
            CandidateChronology = input.CandidateChronology,
            SupportingEvidence = supporting,
            Contradictions = contradictions,
            MissingEvidence = missing
        };
    }

    private static OriginalCandidateConfidence Classify(
        IReadOnlyCollection<OriginalCandidateEvidence> supporting,
        IReadOnlyCollection<OriginalCandidateEvidence> contradictions)
    {
        if (HasEvidence(supporting, OriginalCandidateEvidenceCode.DirectedLineage))
        {
            return OriginalCandidateConfidence.High;
        }

        bool localRootHigh =
            HasEvidence(supporting, OriginalCandidateEvidenceCode.KnownLocalRoot)
            && HasEvidence(supporting, OriginalCandidateEvidenceCode.IdentityMatch)
            && HasEvidence(supporting, OriginalCandidateEvidenceCode.VersionMarker)
            && HasEvidence(supporting, OriginalCandidateEvidenceCode.EarlierChronology)
            && !HasBlockingContradiction(contradictions);
        if (localRootHigh)
        {
            return OriginalCandidateConfidence.High;
        }

        int mediumSignals = 0;
        mediumSignals += HasEvidence(supporting, OriginalCandidateEvidenceCode.KnownLocalRoot) ? 1 : 0;
        mediumSignals += HasEvidence(supporting, OriginalCandidateEvidenceCode.VersionMarker) ? 1 : 0;
        mediumSignals += HasEvidence(supporting, OriginalCandidateEvidenceCode.EarlierChronology) ? 1 : 0;
        mediumSignals += HasEvidence(supporting, OriginalCandidateEvidenceCode.CloseDuration) ? 1 : 0;
        mediumSignals += HasEvidence(supporting, OriginalCandidateEvidenceCode.CreditsSupport) ? 1 : 0;

        return HasEvidence(supporting, OriginalCandidateEvidenceCode.IdentityMatch) && mediumSignals >= 2
            ? OriginalCandidateConfidence.Medium
            : OriginalCandidateConfidence.Low;
    }

    private static bool HasBlockingContradiction(
        IReadOnlyCollection<OriginalCandidateEvidence> contradictions)
    {
        return HasEvidence(contradictions, OriginalCandidateEvidenceCode.LaterChronology)
            || HasEvidence(contradictions, OriginalCandidateEvidenceCode.ArtistMismatch)
            || HasEvidence(contradictions, OriginalCandidateEvidenceCode.MaterialDurationMismatch)
            || HasEvidence(contradictions, OriginalCandidateEvidenceCode.IncompatibleVersionMarker)
            || HasEvidence(contradictions, OriginalCandidateEvidenceCode.UncertainWorkMapping);
    }

    private static bool HasEvidence(
        IEnumerable<OriginalCandidateEvidence> evidence,
        OriginalCandidateEvidenceCode code)
    {
        return evidence.Any(item => item.Code == code);
    }

    private static IReadOnlyList<OriginalCandidateEvidence> SelectEvidence(
        IEnumerable<OriginalCandidateEvidence> evidence,
        OriginalCandidateEvidenceKind kind)
    {
        return
        [
            .. evidence
                .Where(item => item.Kind == kind)
                .OrderBy(item => item.Code)
                .ThenBy(item => item.Channel)
        ];
    }

    private static int ChronologySortGroup(RankedOriginalCandidate candidate)
    {
        return candidate.CandidateChronology is { Complete: true } ? 0 : 1;
    }

    private static DateOnly ChronologyLowerBound(RankedOriginalCandidate candidate)
    {
        return candidate.CandidateChronology is { Complete: true } chronology
            ? chronology.LowerBound
            : DateOnly.MaxValue;
    }

    private static DateOnly ChronologyUpperBound(RankedOriginalCandidate candidate)
    {
        return candidate.CandidateChronology is { Complete: true } chronology
            ? chronology.UpperBound
            : DateOnly.MaxValue;
    }
}
