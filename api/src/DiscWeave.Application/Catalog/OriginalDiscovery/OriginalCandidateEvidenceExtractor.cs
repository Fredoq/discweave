namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public static class OriginalCandidateEvidenceExtractor
{
    private const decimal CloseDurationPercentage = 0.05m;
    private const decimal MaterialDurationPercentage = 0.20m;

    public static OriginalCandidateInput Extract(OriginalCandidateFacts facts)
    {
        ArgumentNullException.ThrowIfNull(facts);

        var evidence = new List<OriginalCandidateEvidence>();

        AddIdentityEvidence(facts, evidence);
        AddArtistEvidence(facts, evidence);
        AddDurationEvidence(facts, evidence);
        AddChronologyEvidence(facts, evidence);
        AddBooleanEvidence(facts, evidence);
        evidence.AddRange(facts.AdditionalEvidence);

        return new OriginalCandidateInput
        {
            CandidateKey = facts.CandidateKey,
            CandidateChronology = facts.CandidateChronology,
            Evidence = evidence,
            HardGates = facts.HardGates,
            CandidateRole = facts.CandidateRole
        };
    }

    private static void AddIdentityEvidence(
        OriginalCandidateFacts facts,
        ICollection<OriginalCandidateEvidence> evidence)
    {
        if (string.IsNullOrWhiteSpace(facts.SourcePrimaryArtist)
            || string.IsNullOrWhiteSpace(facts.CandidatePrimaryArtist))
        {
            return;
        }

        string sourceKey = OriginalDiscoveryTextNormalizer.ForTitleKey(facts.SourceBaseTitle);
        string candidateKey = OriginalDiscoveryTextNormalizer.ForTitleKey(facts.CandidateBaseTitle);
        string sourceArtistKey =
            OriginalDiscoveryTextNormalizer.ForArtistKey(facts.SourcePrimaryArtist);
        string candidateArtistKey =
            OriginalDiscoveryTextNormalizer.ForArtistKey(facts.CandidatePrimaryArtist);

        if (sourceKey.Length > 0
            && sourceKey == candidateKey
            && sourceArtistKey.Length > 0
            && sourceArtistKey == candidateArtistKey)
        {
            Add(evidence, OriginalCandidateEvidenceCode.IdentityMatch, OriginalCandidateEvidenceKind.Support);
            Add(evidence, OriginalCandidateEvidenceCode.MatchingArtist, OriginalCandidateEvidenceKind.Support);
        }
    }

    private static void AddArtistEvidence(
        OriginalCandidateFacts facts,
        ICollection<OriginalCandidateEvidence> evidence)
    {
        if (string.IsNullOrWhiteSpace(facts.SourcePrimaryArtist)
            || string.IsNullOrWhiteSpace(facts.CandidatePrimaryArtist))
        {
            Add(evidence, OriginalCandidateEvidenceCode.MissingArtist, OriginalCandidateEvidenceKind.Missing);
            return;
        }

        string sourceKey = OriginalDiscoveryTextNormalizer.ForArtistKey(facts.SourcePrimaryArtist);
        string candidateKey = OriginalDiscoveryTextNormalizer.ForArtistKey(facts.CandidatePrimaryArtist);
        if (sourceKey.Length == 0 || candidateKey.Length == 0)
        {
            Add(evidence, OriginalCandidateEvidenceCode.MissingArtist, OriginalCandidateEvidenceKind.Missing);
        }
        else if (sourceKey != candidateKey)
        {
            Add(
                evidence,
                OriginalCandidateEvidenceCode.ArtistMismatch,
                OriginalCandidateEvidenceKind.Contradiction);
        }
    }

    private static void AddDurationEvidence(
        OriginalCandidateFacts facts,
        ICollection<OriginalCandidateEvidence> evidence)
    {
        if (facts.SourceDuration is not { } sourceDuration
            || facts.CandidateDuration is not { } candidateDuration)
        {
            Add(evidence, OriginalCandidateEvidenceCode.MissingDuration, OriginalCandidateEvidenceKind.Missing);
            return;
        }

        decimal sourceTicks = Math.Abs((decimal)sourceDuration.Ticks);
        decimal differenceTicks = Math.Abs((decimal)candidateDuration.Ticks - sourceDuration.Ticks);
        decimal closeThresholdTicks = Math.Max(
            TimeSpan.FromSeconds(5).Ticks,
            sourceTicks * CloseDurationPercentage);
        decimal materialThresholdTicks = Math.Max(
            TimeSpan.FromSeconds(30).Ticks,
            sourceTicks * MaterialDurationPercentage);

        if (differenceTicks <= closeThresholdTicks)
        {
            Add(evidence, OriginalCandidateEvidenceCode.CloseDuration, OriginalCandidateEvidenceKind.Support);
        }
        else if (differenceTicks > materialThresholdTicks)
        {
            Add(
                evidence,
                OriginalCandidateEvidenceCode.MaterialDurationMismatch,
                OriginalCandidateEvidenceKind.Contradiction);
        }
    }

    private static void AddChronologyEvidence(
        OriginalCandidateFacts facts,
        ICollection<OriginalCandidateEvidence> evidence)
    {
        if (facts.SourceChronology is not { } sourceChronology
            || facts.CandidateChronology is not { } candidateChronology)
        {
            Add(evidence, OriginalCandidateEvidenceCode.MissingChronology, OriginalCandidateEvidenceKind.Missing);
            return;
        }

        if (!sourceChronology.Complete || !candidateChronology.Complete)
        {
            Add(
                evidence,
                OriginalCandidateEvidenceCode.IncompleteChronology,
                OriginalCandidateEvidenceKind.Contradiction);
            return;
        }

        if (candidateChronology.UpperBound < sourceChronology.LowerBound)
        {
            Add(
                evidence,
                OriginalCandidateEvidenceCode.EarlierChronology,
                OriginalCandidateEvidenceKind.Support);
        }
        else if (candidateChronology.LowerBound > sourceChronology.UpperBound)
        {
            Add(
                evidence,
                OriginalCandidateEvidenceCode.LaterChronology,
                OriginalCandidateEvidenceKind.Contradiction);
        }
    }

    private static void AddBooleanEvidence(
        OriginalCandidateFacts facts,
        ICollection<OriginalCandidateEvidence> evidence)
    {
        if (facts.DirectedLineage)
        {
            Add(evidence, OriginalCandidateEvidenceCode.DirectedLineage, OriginalCandidateEvidenceKind.Support);
        }

        if (facts.KnownLocalRoot)
        {
            Add(evidence, OriginalCandidateEvidenceCode.KnownLocalRoot, OriginalCandidateEvidenceKind.Support);
        }

        if (facts.VersionMarker)
        {
            Add(evidence, OriginalCandidateEvidenceCode.VersionMarker, OriginalCandidateEvidenceKind.Support);
        }
        else
        {
            Add(evidence, OriginalCandidateEvidenceCode.MissingVersionMarker, OriginalCandidateEvidenceKind.Missing);
        }

        if (facts.CreditsSupport)
        {
            Add(evidence, OriginalCandidateEvidenceCode.CreditsSupport, OriginalCandidateEvidenceKind.Support);
        }

        if (!facts.StructuralEvidenceComplete)
        {
            Add(
                evidence,
                OriginalCandidateEvidenceCode.IncompleteStructuralEvidence,
                OriginalCandidateEvidenceKind.Contradiction);
        }

        if (facts.SourceClassification is not null && facts.CandidateClassification is not null)
        {
            bool compatible = OriginalVersionClassifier.IsCompatible(
                facts.SourceClassification.Kinds,
                facts.CandidateClassification.Kinds);
            Add(
                evidence,
                compatible
                    ? OriginalCandidateEvidenceCode.CompatibleVersionRole
                    : OriginalCandidateEvidenceCode.IncompatibleCandidateRole,
                compatible
                    ? OriginalCandidateEvidenceKind.Support
                    : OriginalCandidateEvidenceKind.Contradiction);

            if (facts.CandidateClassification.Kinds.Contains(OriginalVersionKind.Original))
            {
                Add(
                    evidence,
                    OriginalCandidateEvidenceCode.ExplicitOriginalVersion,
                    OriginalCandidateEvidenceKind.Support);
            }

            if (facts.CandidateClassification.Marker is null)
            {
                Add(
                    evidence,
                    OriginalCandidateEvidenceCode.BareBaseTitle,
                    OriginalCandidateEvidenceKind.Support);
            }
        }
    }

    private static void Add(
        ICollection<OriginalCandidateEvidence> evidence,
        OriginalCandidateEvidenceCode code,
        OriginalCandidateEvidenceKind kind)
    {
        evidence.Add(new OriginalCandidateEvidence
        {
            Code = code,
            Kind = kind,
            Channel = OriginalCandidateEvidenceChannel.LocalCatalog
        });
    }
}
