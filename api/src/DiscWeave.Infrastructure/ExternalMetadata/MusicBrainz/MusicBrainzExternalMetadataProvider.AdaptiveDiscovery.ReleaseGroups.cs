using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    private const string ReleaseGroupSearchWarning =
        "musicbrainz.release_group_search_incomplete";

    private async Task<bool> CollectReleaseGroupCandidatesAsync(
        RecordingLineageQuery query,
        LineageSource source,
        List<RecordingLineageCandidate> candidates,
        List<string> warnings,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        string baseTitle = query.BaseTitle?.Trim() ?? OriginalVersionClassifier.Classify(query.Title).BaseTitle;
        string? artist = source.Detail.Artists.Count > 0 ? source.Detail.Artists[0] : query.Artists.Count > 0 ? query.Artists[0] : null;
        if (string.IsNullOrWhiteSpace(baseTitle) || string.IsNullOrWhiteSpace(artist))
        {
            AddWarning(warnings, SourceReleaseContextWarning);
            return false;
        }

        ExternalMetadataResult<ReleaseGroupSearchOutcome> search = await SearchReleaseGroupsAsync(
            BuildReleaseGroupQuery(baseTitle, artist), context, cancellationToken).ConfigureAwait(false);
        if (!search.IsSuccess)
        {
            AddWarning(warnings, SourceReleaseContextWarning);
            if (IsOperationExhaustion(search.Error))
            {
                AddWarning(warnings, OperationBudgetExhaustedCode);
            }

            return false;
        }

        bool complete = true;
        if (search.Value.Total is > 0 && search.Value.Total > search.Value.Groups.Count)
        {
            complete = false;
            AddWarning(warnings, ReleaseGroupSearchWarning);
        }

        foreach (ReleaseGroupHypothesis group in search.Value.Groups)
        {
            ExternalMetadataResult<ReleaseContextOutcome> groupContext = await BrowseReleaseGroupContextAsync(
                group.Mbid, context, cancellationToken).ConfigureAwait(false);
            if (!groupContext.IsSuccess)
            {
                complete = false;
                AddWarning(warnings, SourceReleaseContextWarning);
                if (IsOperationExhaustion(groupContext.Error))
                {
                    AddWarning(warnings, OperationBudgetExhaustedCode);
                    return false;
                }

                continue;
            }

            complete &= groupContext.Value.Complete;
            warnings.AddRange(groupContext.Value.Warnings);
            foreach (ReleaseRoute release in groupContext.Value.Releases)
            {
                foreach (ExternalMetadataReleaseTrack track in release.Tracks)
                {
                    ExternalMetadataSource? recordingSource = track.ExternalSources.FirstOrDefault(reference =>
                        string.Equals(reference.ProviderName, ProviderCodeValue, StringComparison.Ordinal) &&
                        string.Equals(reference.ResourceType, "recording", StringComparison.Ordinal));
                    if (recordingSource is null || string.Equals(recordingSource.ExternalId, source.Detail.Mbid, StringComparison.Ordinal))
                    {
                        continue;
                    }

                    OriginalVersionClassification sourceClassification = OriginalVersionClassifier.Classify(query.Title);
                    OriginalVersionClassification candidateClassification = OriginalVersionClassifier.Classify(track.Title);
                    if (!IsCompatibleShortlistCandidate(sourceClassification, candidateClassification, query.BaseTitle))
                    {
                        continue;
                    }

                    ExternalMetadataResult<RecordingDetailOutcome> detail = await GetRecordingDetailAsync(
                        recordingSource.ExternalId, context, cancellationToken).ConfigureAwait(false);
                    if (!detail.IsSuccess)
                    {
                        complete = false;
                        AddWarning(warnings, AdaptiveCandidateDetailWarning);
                        if (IsOperationExhaustion(detail.Error))
                        {
                            AddWarning(warnings, OperationBudgetExhaustedCode);
                            return false;
                        }

                        continue;
                    }

                    RecordingWorkEvidence[] workEvidence = MapWorkEvidence(detail.Value);
                    if (workEvidence.Any(evidence => evidence.ExplicitCover))
                    {
                        continue;
                    }

                    ExternalMetadataResult<ReleaseBrowseOutcome> browse = await BrowseReleasePagesAsync(
                        detail.Value.Mbid, context, cancellationToken).ConfigureAwait(false);
                    IReadOnlyList<ReleaseRoute> routes = browse.IsSuccess ? [.. browse.Value.Releases, release] : [release];
                    bool structurallyComplete = groupContext.Value.Complete && browse.IsSuccess && browse.Value.ChronologyComplete;
                    var evidence = new List<OriginalCandidateEvidence>
                    {
                        Evidence(OriginalCandidateEvidenceCode.SameReleaseGroup, OriginalCandidateEvidenceKind.Support),
                        Evidence(OriginalCandidateEvidenceCode.CompatibleVersionRole, OriginalCandidateEvidenceKind.Support)
                    };
                    if (candidateClassification.Marker is null)
                    {
                        evidence.Add(Evidence(OriginalCandidateEvidenceCode.BareBaseTitle, OriginalCandidateEvidenceKind.Support));
                    }

                    if (candidateClassification.Kinds.Contains(OriginalVersionKind.Original))
                    {
                        evidence.Add(Evidence(OriginalCandidateEvidenceCode.ExplicitOriginalVersion, OriginalCandidateEvidenceKind.Support));
                    }

                    if (SamePrimaryArtist(source.Detail.Artists, detail.Value.Artists))
                    {
                        evidence.Add(Evidence(OriginalCandidateEvidenceCode.MatchingArtist, OriginalCandidateEvidenceKind.Support));
                    }

                    AddReleaseEvidence(evidence, routes, source.Detail.Artists);
                    if (!structurallyComplete)
                    {
                        evidence.Add(Evidence(OriginalCandidateEvidenceCode.IncompleteStructuralEvidence, OriginalCandidateEvidenceKind.Contradiction));
                        complete = false;
                    }

                    OriginalCandidateRole role = candidateClassification.Marker is null ||
                        candidateClassification.Kinds.Contains(OriginalVersionKind.Original) ||
                        candidateClassification.Kinds.Contains(OriginalVersionKind.Album)
                            ? OriginalCandidateRole.HistoricalRoot
                            : OriginalCandidateRole.Diagnostic;
                    candidates.Add(MapInferredCandidate(
                        detail.Value, workEvidence, routes,
                        new HashSet<OriginalDiscoveryPath>
                        {
                            OriginalDiscoveryPath.SourceReleaseGroup,
                            OriginalDiscoveryPath.ReleaseGroupSearch
                        }, role, structurallyComplete, evidence));
                }
            }
        }

        return complete;
    }

    private static string BuildReleaseGroupQuery(string baseTitle, string artist)
    {
        string normalizedTitle = baseTitle.Replace("\"", "", StringComparison.Ordinal).Trim();
        string normalizedArtist = artist.Replace("\"", "", StringComparison.Ordinal).Trim();
        return $"releasegroup:\"{normalizedTitle}\" AND artist:\"{normalizedArtist}\"";
    }
}
