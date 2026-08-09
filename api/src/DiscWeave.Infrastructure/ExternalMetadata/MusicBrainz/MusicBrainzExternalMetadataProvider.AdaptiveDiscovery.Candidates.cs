using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    private async Task<ExternalMetadataResult<AdaptiveCandidateLoadOutcome>> LoadInferredCandidateAsync(
        RecordingLineageQuery query,
        LineageSource source,
        WorkRecordingHypothesis hypothesis,
        WorkPerformanceOutcome work,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        if (string.Equals(hypothesis.Mbid, source.Detail.Mbid, StringComparison.Ordinal))
        {
            return new ExternalMetadataResult<AdaptiveCandidateLoadOutcome>(new AdaptiveCandidateLoadOutcome(null));
        }

        ExternalMetadataResult<RecordingDetailOutcome> detail = await GetRecordingDetailAsync(
            hypothesis.Mbid, context, cancellationToken).ConfigureAwait(false);
        if (!detail.IsSuccess)
        {
            return new ExternalMetadataResult<AdaptiveCandidateLoadOutcome>(detail.Error);
        }

        RecordingWorkEvidence[] workEvidence = MapWorkEvidence(detail.Value);
        if (workEvidence.Any(evidence => evidence.ExplicitCover))
        {
            return new ExternalMetadataResult<AdaptiveCandidateLoadOutcome>(new AdaptiveCandidateLoadOutcome(null));
        }

        ExternalMetadataResult<ReleaseBrowseOutcome> browse = await BrowseReleasePagesAsync(
            detail.Value.Mbid, context, cancellationToken).ConfigureAwait(false);
        OriginalVersionClassification sourceClassification = OriginalVersionClassifier.Classify(query.Title);
        OriginalVersionClassification candidateClassification = OriginalVersionClassifier.Classify(detail.Value.Title);
        OriginalCandidateRole role = candidateClassification.Marker is null ||
            candidateClassification.Kinds.Contains(OriginalVersionKind.Original) ||
            candidateClassification.Kinds.Contains(OriginalVersionKind.Album)
                ? OriginalCandidateRole.HistoricalRoot
                : OriginalCandidateRole.Diagnostic;
        var paths = new HashSet<OriginalDiscoveryPath> { OriginalDiscoveryPath.SharedWorkPerformance };
        IReadOnlyList<ReleaseRoute> routes = browse.IsSuccess ? browse.Value.Releases : [];
        bool complete = browse.IsSuccess && browse.Value.ChronologyComplete && work.Complete;
        if (browse.IsSuccess && routes.Count == 0)
        {
            complete = false;
        }

        var evidence = new List<OriginalCandidateEvidence>
        {
            Evidence(OriginalCandidateEvidenceCode.SharedWork, OriginalCandidateEvidenceKind.Support)
        };
        if (SamePrimaryArtist(source.Detail.Artists, detail.Value.Artists))
        {
            evidence.Add(Evidence(OriginalCandidateEvidenceCode.MatchingArtist, OriginalCandidateEvidenceKind.Support));
        }

        if (OriginalVersionClassifier.IsCompatible(sourceClassification.Kinds, candidateClassification.Kinds))
        {
            evidence.Add(Evidence(OriginalCandidateEvidenceCode.CompatibleVersionRole, OriginalCandidateEvidenceKind.Support));
        }
        else
        {
            evidence.Add(Evidence(OriginalCandidateEvidenceCode.IncompatibleCandidateRole, OriginalCandidateEvidenceKind.Contradiction));
        }

        if (candidateClassification.Marker is null)
        {
            evidence.Add(Evidence(OriginalCandidateEvidenceCode.BareBaseTitle, OriginalCandidateEvidenceKind.Support));
        }

        if (candidateClassification.Kinds.Contains(OriginalVersionKind.Original))
        {
            evidence.Add(Evidence(OriginalCandidateEvidenceCode.ExplicitOriginalVersion, OriginalCandidateEvidenceKind.Support));
        }

        AddReleaseEvidence(evidence, routes, source.Detail.Artists);
        if (!complete)
        {
            evidence.Add(Evidence(OriginalCandidateEvidenceCode.IncompleteStructuralEvidence, OriginalCandidateEvidenceKind.Contradiction));
        }

        return new ExternalMetadataResult<AdaptiveCandidateLoadOutcome>(new AdaptiveCandidateLoadOutcome(
            MapInferredCandidate(detail.Value, workEvidence, routes, paths, role, complete, evidence)));
    }

    private static RecordingLineageCandidate MapInferredCandidate(
        RecordingDetailOutcome detail,
        IReadOnlyList<RecordingWorkEvidence> workEvidence,
        IReadOnlyList<ReleaseRoute> releases,
        IReadOnlySet<OriginalDiscoveryPath> paths,
        OriginalCandidateRole role,
        bool complete,
        IReadOnlyList<OriginalCandidateEvidence>? evidence = null)
    {
        RecordingReleaseRoute[] routes = MapReleaseRoutes(
            releases,
            detail.Mbid,
            out bool invalidRoute);
        bool structuralComplete = complete && !invalidRoute;
        List<OriginalCandidateEvidence> allEvidence = [.. evidence ?? []];
        if (!structuralComplete)
        {
            allEvidence.Add(Evidence(OriginalCandidateEvidenceCode.IncompleteStructuralEvidence, OriginalCandidateEvidenceKind.Contradiction));
        }

        return new RecordingLineageCandidate
        {
            RecordingSource = MusicBrainzSource("recording", detail.Mbid),
            Title = detail.Title,
            Artists = detail.Artists,
            Duration = detail.RecordingDuration,
            Relations = [],
            WorkEvidence = workEvidence,
            ReleaseRoutes = routes,
            ChronologyComplete = structuralComplete,
            Warnings = structuralComplete ? [] : [ChronologyIncompleteWarning],
            DiscoveryContext = new RecordingDiscoveryContext
            {
                Role = role,
                Paths = paths,
                Evidence = allEvidence,
                StructuralEvidenceComplete = structuralComplete
            }
        };
    }
}
