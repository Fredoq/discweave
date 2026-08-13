using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    private const string AdaptiveWorkLimitWarning =
        "musicbrainz.work_candidate_limit_reached";
    private const string AdaptiveCandidateDetailWarning =
        "musicbrainz.candidate_detail_failed";

    private async Task<AdaptiveDiscoveryOutcome> CollectAdaptiveCandidatesAsync( // NOSONAR: adaptive discovery intentionally coordinates multiple bounded routes.
        RecordingLineageQuery query,
        LineageSourceResolution sourceResolution,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        OriginalVersionClassification queryVersionClassification = OriginalVersionClassifier.Classify(query.Title);
        if (queryVersionClassification.Marker is null && string.IsNullOrWhiteSpace(query.BaseTitle))
        {
            return new AdaptiveDiscoveryOutcome([], [], true);
        }

        var candidates = new List<RecordingLineageCandidate>();
        var warnings = new List<string>();
        bool complete = true;

        foreach (LineageSource source in sourceResolution.Sources)
        {
            string[] workMbids = WorkMbids(source.Detail);
            foreach (string workMbid in workMbids)
            {
                ExternalMetadataResult<WorkPerformanceOutcome> work =
                    await GetWorkPerformancesAsync(
                        workMbid,
                        context,
                        cancellationToken).ConfigureAwait(false);
                if (!work.IsSuccess)
                {
                    complete = false;
                    AddWarning(warnings, WorkContextWarning);
                    if (IsOperationExhaustion(work.Error))
                    {
                        AddWarning(warnings, OperationBudgetExhaustedCode);
                        return new AdaptiveDiscoveryOutcome(candidates, warnings, false);
                    }

                    continue;
                }

                complete &= work.Value.Complete;
                warnings.AddRange(work.Value.Warnings);
                WorkRecordingHypothesis[] shortlist = ShortlistWorkPerformances(
                    query,
                    source.Detail.Mbid,
                    work.Value.Recordings);
                if (shortlist.Length < work.Value.Recordings.Count)
                {
                    AddWarning(warnings, AdaptiveWorkLimitWarning);
                    complete = false;
                }

                foreach (WorkRecordingHypothesis hypothesis in shortlist)
                {
                    ExternalMetadataResult<AdaptiveCandidateLoadOutcome> candidate =
                        await LoadInferredCandidateAsync(
                            query,
                            source,
                            hypothesis,
                            work.Value,
                            context,
                            cancellationToken).ConfigureAwait(false);
                    if (!candidate.IsSuccess)
                    {
                        complete = false;
                        AddWarning(warnings, AdaptiveCandidateDetailWarning);
                        if (IsOperationExhaustion(candidate.Error))
                        {
                            AddWarning(warnings, OperationBudgetExhaustedCode);
                            return new AdaptiveDiscoveryOutcome(candidates, warnings, false);
                        }

                        continue;
                    }

                    if (candidate.Value.Candidate is not null)
                    {
                        candidates.Add(candidate.Value.Candidate);
                        complete &= candidate.Value.Candidate.DiscoveryContext?.StructuralEvidenceComplete ?? false;
                    }
                }
            }

            if ((workMbids.Length == 0 ||
                    !candidates.Any(candidate => candidate.ReleaseRoutes.Count > 0)) &&
                !string.IsNullOrWhiteSpace(query.BaseTitle))
            {
                complete &= await CollectReleaseGroupCandidatesAsync(
                    query,
                    source,
                    candidates,
                    warnings,
                    context,
                    cancellationToken).ConfigureAwait(false);
            }

            if (workMbids.Length == 0)
            {
                continue;
            }

            ExternalMetadataResult<ReleaseContextOutcome> releaseContext =
                await BrowseSourceReleaseContextAsync(
                    source.Detail.Mbid,
                    context,
                    cancellationToken).ConfigureAwait(false);
            if (!releaseContext.IsSuccess)
            {
                complete = false;
                AddWarning(warnings, SourceReleaseContextWarning);
                if (IsOperationExhaustion(releaseContext.Error))
                {
                    AddWarning(warnings, OperationBudgetExhaustedCode);
                    return new AdaptiveDiscoveryOutcome(candidates, warnings, false);
                }

                continue;
            }

            complete &= releaseContext.Value.Complete;
            warnings.AddRange(releaseContext.Value.Warnings);
            foreach (ReleaseRoute release in releaseContext.Value.Releases)
            {
                foreach (ExternalMetadataReleaseTrack track in release.Tracks)
                {
                    string? recordingMbid = track.ExternalSources
                        .FirstOrDefault(sourceReference =>
                            string.Equals(sourceReference.ProviderName, ProviderCodeValue, StringComparison.Ordinal)
                            && string.Equals(sourceReference.ResourceType, "recording", StringComparison.Ordinal))
                        ?.ExternalId;
                    if (recordingMbid is null ||
                        string.Equals(recordingMbid, source.Detail.Mbid, StringComparison.Ordinal))
                    {
                        continue;
                    }

                    OriginalVersionClassification sourceClassification =
                        OriginalVersionClassifier.Classify(query.Title);
                    OriginalVersionClassification candidateClassification =
                        OriginalVersionClassifier.Classify(track.Title);
                    if (!IsCompatibleShortlistCandidate(
                            sourceClassification,
                            candidateClassification,
                            query.BaseTitle))
                    {
                        continue;
                    }

                    ExternalMetadataResult<RecordingDetailOutcome> detail =
                        await GetRecordingDetailAsync(
                            recordingMbid,
                            context,
                            cancellationToken).ConfigureAwait(false);
                    if (!detail.IsSuccess)
                    {
                        complete = false;
                        AddWarning(warnings, AdaptiveCandidateDetailWarning);
                        if (IsOperationExhaustion(detail.Error))
                        {
                            AddWarning(warnings, OperationBudgetExhaustedCode);
                            return new AdaptiveDiscoveryOutcome(candidates, warnings, false);
                        }

                        continue;
                    }

                    RecordingWorkEvidence[] workEvidence = MapWorkEvidence(detail.Value);
                    ExternalMetadataResult<ReleaseBrowseOutcome> browse =
                        await BrowseReleasePagesAsync(
                            detail.Value.Mbid,
                            context,
                            cancellationToken).ConfigureAwait(false);
                    IReadOnlyList<ReleaseRoute> routes = browse.IsSuccess
                        ? [.. browse.Value.Releases, release]
                        : [release];
                    candidates.Add(MapInferredCandidate(
                        detail.Value,
                        workEvidence,
                        routes,
                        new HashSet<OriginalDiscoveryPath>
                        {
                            OriginalDiscoveryPath.SourceReleaseSibling
                        },
                        OriginalCandidateRole.ImmediateParent,
                        browse.IsSuccess && browse.Value.ChronologyComplete && releaseContext.Value.Complete));
                }
            }
        }

        return new AdaptiveDiscoveryOutcome(candidates, SortedWarnings(warnings), complete);
    }

    private sealed record AdaptiveCandidateLoadOutcome(RecordingLineageCandidate? Candidate);

    private sealed record AdaptiveDiscoveryOutcome(
        IReadOnlyList<RecordingLineageCandidate> Candidates,
        IReadOnlyList<string> Warnings,
        bool Complete);
}
