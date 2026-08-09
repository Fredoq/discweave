using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    private const string RecordingRemixRelationId = "bfbdb55a-b857-473a-8f2e-a9c09e45c3f5";
    private const string RecordingEditRelationId = "ce01b3ac-dd47-4702-9302-085344f96e84";
    private const string PerformanceCoverAttributeId = "1e8536bd-6eda-3822-8e78-1c0f4d3d2113";
    private const string ReleaseGroupRerecordingRelationId = "26ce3301-cf1f-4ce4-a7e2-9670f9a9e1d5";
    private const string CandidateDetailFailedWarning = "musicbrainz.candidate_detail_failed";
    private const string LineageTargetLimitWarning = "musicbrainz.lineage_target_limit_reached";

    public Task<ExternalMetadataResult<RecordingLineageResult>> FindOriginalsAsync(
        RecordingLineageQuery query,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        return !_options.Enabled
            ? Task.FromResult(Failure<RecordingLineageResult>(Disabled()))
            : string.IsNullOrWhiteSpace(query.Title) || query.Artists is null
                ? Task.FromResult(Failure<RecordingLineageResult>(InvalidResponse()))
                : ExecuteOwnedAsync(
                    "find-originals",
                    result => result.Candidates.Count,
                    context => FindOriginalsCoreAsync(query, context, CancellationToken.None),
                    cancellationToken);
    }

    private async Task<ExternalMetadataResult<RecordingLineageResult>> FindOriginalsCoreAsync(
        RecordingLineageQuery query,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        ExternalMetadataResult<LineageSourceResolution> sourceResult =
            await ResolveLineageSourcesAsync(query, context, cancellationToken).ConfigureAwait(false);
        if (!sourceResult.IsSuccess)
        {
            return Failure<RecordingLineageResult>(sourceResult.Error);
        }

        LineageSourceResolution sourceResolution = sourceResult.Value;
        if (sourceResolution.OperationStopped)
        {
            return SuccessResult(
                sourceResolution.SelectedRecording,
                [],
                chronologyComplete: false,
                [OperationBudgetExhaustedCode],
                sourceResolution.SearchDiagnostics);
        }

        if (query.SearchMode == OriginalDiscoverySearchMode.ReleaseFirst)
        {
            return await FindReleaseFirstOriginalsAsync(
                query,
                sourceResolution,
                context,
                cancellationToken).ConfigureAwait(false);
        }

        IReadOnlyList<LineageTarget> targets = CollectLineageTargets(
            sourceResolution.Sources,
            _options.MaxLineageCandidates,
            out bool targetsTruncated);
        var resultWarnings = new List<string>();
        bool resultChronologyComplete = !targetsTruncated;
        if (targetsTruncated)
        {
            AddWarning(resultWarnings, LineageTargetLimitWarning);
        }

        var candidates = new List<RecordingLineageCandidate>();
        foreach (LineageTarget target in targets)
        {
            ExternalMetadataResult<RecordingDetailOutcome> detail = await GetRecordingDetailAsync(
                target.Mbid,
                context,
                cancellationToken).ConfigureAwait(false);
            if (!detail.IsSuccess)
            {
                resultChronologyComplete = false;
                if (IsOperationExhaustion(detail.Error))
                {
                    AddWarning(resultWarnings, OperationBudgetExhaustedCode);
                    break;
                }

                AddWarning(resultWarnings, CandidateDetailFailedWarning);
                continue;
            }

            RecordingWorkEvidence[] workEvidence = MapWorkEvidence(detail.Value);
            if (workEvidence.Any(work => work.ExplicitCover))
            {
                continue;
            }

            ExternalMetadataResult<ReleaseBrowseOutcome> browse = await BrowseReleasePagesAsync(
                target.Mbid,
                context,
                cancellationToken).ConfigureAwait(false);
            RecordingLineageCandidate candidate = MapLineageCandidate(
                target,
                detail.Value,
                workEvidence,
                browse);
            candidates.Add(candidate);
            if (!candidate.ChronologyComplete)
            {
                resultChronologyComplete = false;
            }

            if (candidate.Warnings.Contains(OperationBudgetExhaustedCode, StringComparer.Ordinal))
            {
                AddWarning(resultWarnings, OperationBudgetExhaustedCode);
                break;
            }
        }

        AdaptiveDiscoveryOutcome adaptive = await CollectAdaptiveCandidatesAsync(
            query,
            sourceResolution,
            context,
            cancellationToken).ConfigureAwait(false);
        resultWarnings.AddRange(adaptive.Warnings);
        resultChronologyComplete &= adaptive.Complete;
        candidates = [.. MergeCandidates(candidates.Concat(adaptive.Candidates))];

        IReadOnlyList<RecordingLineageCandidate> enriched = await EnrichReleaseGroupsAsync(
            candidates,
            context,
            cancellationToken).ConfigureAwait(false);
        return SuccessResult(
            sourceResolution.SelectedRecording,
            enriched,
            resultChronologyComplete && enriched.All(candidate => candidate.ChronologyComplete),
            resultWarnings,
            sourceResolution.SearchDiagnostics);
    }

    private async Task<ExternalMetadataResult<LineageSourceResolution>> ResolveLineageSourcesAsync(
        RecordingLineageQuery query,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        if (query.KnownRecording is not null)
        {
            if (!IsRecordingSource(query.KnownRecording, out string knownMbid))
            {
                return Failure<LineageSourceResolution>(InvalidResponse());
            }

            ExternalMetadataSource selected = MusicBrainzSource("recording", knownMbid);
            ExternalMetadataResult<RecordingDetailOutcome> detail = await GetRecordingDetailAsync(
                knownMbid,
                context,
                cancellationToken).ConfigureAwait(false);
            return detail.IsSuccess
                ? new ExternalMetadataResult<LineageSourceResolution>(
                    new LineageSourceResolution(
                        selected,
                        [new LineageSource(detail.Value, int.MaxValue)],
                        operationStopped: false))
                : IsOperationExhaustion(detail.Error)
                    ? new ExternalMetadataResult<LineageSourceResolution>(
                        new LineageSourceResolution(selected, [], operationStopped: true))
                    : Failure<LineageSourceResolution>(detail.Error);
        }

        var diagnostics = new List<ExternalProviderSearchDiagnostic>();
        RecordingSearchOutcome? selectedSearch = null;
        foreach (string searchTitle in SearchTitles(query))
        {
            ExternalMetadataResult<RecordingSearchOutcome> search = await SearchRecordingsAsync(
                searchTitle,
                query.Artists,
                context,
                cancellationToken).ConfigureAwait(false);
            if (!search.IsSuccess)
            {
                return IsOperationExhaustion(search.Error)
                    ? new ExternalMetadataResult<LineageSourceResolution>(
                        new LineageSourceResolution(
                            null,
                            [],
                            operationStopped: true,
                            diagnostics))
                    : Failure<LineageSourceResolution>(search.Error);
            }

            diagnostics.Add(ToSearchDiagnostic(searchTitle, query.Artists, search.Value));
            selectedSearch = search.Value;
            if (search.Value.Recordings.Count > 0)
            {
                break;
            }
        }

        var sources = new List<LineageSource>();
        foreach (RecordingHypothesis hypothesis in selectedSearch?.Recordings ?? [])
        {
            ExternalMetadataResult<RecordingDetailOutcome> detail = await GetRecordingDetailAsync(
                hypothesis.Mbid,
                context,
                cancellationToken).ConfigureAwait(false);
            if (!detail.IsSuccess)
            {
                return IsOperationExhaustion(detail.Error)
                    ? new ExternalMetadataResult<LineageSourceResolution>(
                        new LineageSourceResolution(
                            null,
                            sources,
                            operationStopped: true,
                            diagnostics))
                    : Failure<LineageSourceResolution>(detail.Error);
            }

            sources.Add(new LineageSource(detail.Value, hypothesis.Score));
        }

        return new ExternalMetadataResult<LineageSourceResolution>(
            new LineageSourceResolution(
                null,
                sources,
                operationStopped: false,
                diagnostics));
    }

    private static IReadOnlyList<string> SearchTitles(RecordingLineageQuery query)
    {
        string title = query.Title.Trim();
        string? baseTitle = string.IsNullOrWhiteSpace(query.BaseTitle)
            ? null
            : query.BaseTitle.Trim();
        return baseTitle is null || string.Equals(title, baseTitle, StringComparison.OrdinalIgnoreCase)
            ? [title]
            : [title, baseTitle];
    }

    private ExternalProviderSearchDiagnostic ToSearchDiagnostic(
        string title,
        IReadOnlyList<string> artists,
        RecordingSearchOutcome outcome)
    {
        string query = BuildRecordingQuery(title, artists);
        string path = RecordingSearchPath(query, _options.MaxRecordingCandidates);
        return new ExternalProviderSearchDiagnostic
        {
            ProviderCode = ProviderCodeValue,
            RequestUrl = new Uri(new Uri(_options.BaseUrl, UriKind.Absolute), path).AbsoluteUri,
            TotalResults = outcome.Total,
            Offset = 0,
            Items =
            [
                .. outcome.Recordings.Select(recording =>
                    new ExternalProviderSearchDiagnosticItem
                    {
                        ExternalId = recording.Mbid,
                        Title = recording.Title,
                        Artists = recording.Artists,
                        Duration = recording.Duration,
                        Score = recording.Score
                    })
            ]
        };
    }

    private static bool IsRecordingSource(ExternalMetadataSource source, out string mbid)
    {
        mbid = string.Empty;
        return string.Equals(source.ProviderName, ProviderCodeValue, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(source.ResourceType, "recording", StringComparison.OrdinalIgnoreCase) &&
            TryNormalizeMbid(source.ExternalId, out mbid);
    }

    private static bool IsOperationExhaustion(ExternalMetadataError error)
    {
        return string.Equals(error.Code, OperationBudgetExhaustedCode, StringComparison.Ordinal) ||
            error.Kind == ExternalMetadataErrorKind.Timeout;
    }
}
