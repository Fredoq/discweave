using DiscWeave.Application.Catalog.OriginalDiscovery;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    private WorkRecordingHypothesis[] ShortlistWorkPerformances(
        RecordingLineageQuery query,
        string sourceMbid,
        IReadOnlyList<WorkRecordingHypothesis> recordings)
    {
        OriginalVersionClassification sourceClassification = OriginalVersionClassifier.Classify(query.Title);
        string baseTitle = query.BaseTitle?.Trim() ?? sourceClassification.BaseTitle;
        string baseKey = OriginalDiscoveryTextNormalizer.ForTitleKey(baseTitle);
        return
        [
            .. recordings
                .Where(recording => !string.Equals(recording.Mbid, sourceMbid, StringComparison.Ordinal))
                .OrderByDescending(recording => OriginalDiscoveryTextNormalizer.ForTitleKey(OriginalVersionClassifier.Classify(recording.Title).BaseTitle) == baseKey)
                .ThenByDescending(recording => OriginalVersionClassifier.Classify(recording.Title).Kinds.Contains(OriginalVersionKind.Original))
                .ThenByDescending(recording => OriginalVersionClassifier.Classify(recording.Title).Marker is null)
                .ThenByDescending(recording => OriginalVersionClassifier.IsCompatible(sourceClassification.Kinds, OriginalVersionClassifier.Classify(recording.Title).Kinds))
                .ThenBy(recording => recording.Mbid, StringComparer.Ordinal)
                .Take(_options.MaxWorkRecordingCandidates)
        ];
    }

    private static bool IsCompatibleShortlistCandidate(
        OriginalVersionClassification source,
        OriginalVersionClassification candidate,
        string? baseTitle)
    {
        string expectedKey = OriginalDiscoveryTextNormalizer.ForTitleKey(baseTitle ?? source.BaseTitle);
        string candidateKey = OriginalDiscoveryTextNormalizer.ForTitleKey(candidate.BaseTitle);
        return expectedKey.Length > 0 && expectedKey == candidateKey && OriginalVersionClassifier.IsCompatible(source.Kinds, candidate.Kinds);
    }

    private static void AddReleaseEvidence(
        List<OriginalCandidateEvidence> evidence,
        IReadOnlyList<ReleaseRoute> routes,
        IReadOnlyList<string> sourceArtists)
    {
        if (routes.Any(route => string.Equals(route.Status, "Official", StringComparison.OrdinalIgnoreCase)))
        {
            evidence.Add(Evidence(OriginalCandidateEvidenceCode.OfficialArtistRelease, OriginalCandidateEvidenceKind.Support));
        }

        if (routes.Any(route => string.Equals(route.Status, "Official", StringComparison.OrdinalIgnoreCase) && SamePrimaryArtist(sourceArtists, route.Artists)))
        {
            evidence.Add(Evidence(OriginalCandidateEvidenceCode.MatchingArtist, OriginalCandidateEvidenceKind.Support));
        }
    }

    private static string[] WorkMbids(RecordingDetailOutcome detail)
    {
        return
        [
            .. detail.Relations
                .Where(relation => string.Equals(relation.TargetType, "work", StringComparison.Ordinal) && relation.TargetMbid is not null)
                .Select(relation => relation.TargetMbid!)
                .Distinct(StringComparer.Ordinal)
        ];
    }

    private static bool SamePrimaryArtist(IReadOnlyList<string> left, IReadOnlyList<string> right)
    {
        return left.Count > 0 && right.Count > 0 &&
            OriginalDiscoveryTextNormalizer.ForArtistKey(left[0]) == OriginalDiscoveryTextNormalizer.ForArtistKey(right[0]);
    }

    private static OriginalCandidateEvidence Evidence(
        OriginalCandidateEvidenceCode code,
        OriginalCandidateEvidenceKind kind)
    {
        return new OriginalCandidateEvidence
        {
            Code = code,
            Kind = kind,
            Channel = OriginalCandidateEvidenceChannel.MusicBrainz
        };
    }
}
