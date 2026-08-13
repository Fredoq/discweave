using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    private async Task<ExternalMetadataResult<RecordingLineageResult>>
        FindReleaseFirstOriginalsAsync(
            RecordingLineageQuery query,
            LineageSourceResolution sourceResolution,
            MusicBrainzOperationContext context,
            CancellationToken cancellationToken)
    {
        var candidates = new List<RecordingLineageCandidate>();
        var warnings = new List<string>();
        LineageSource? source = sourceResolution.Sources.Count > 0
            ? sourceResolution.Sources[0]
            : null;
        bool complete = source is not null &&
            await CollectReleaseGroupCandidatesAsync(
                query,
                source,
                candidates,
                warnings,
                context,
                cancellationToken).ConfigureAwait(false);

        IReadOnlyList<RecordingLineageCandidate> merged =
            MergeCandidates(candidates);
        IReadOnlyList<RecordingLineageCandidate> enriched =
            await EnrichReleaseGroupsAsync(
                merged,
                context,
                cancellationToken).ConfigureAwait(false);
        return SuccessResult(
            sourceResolution.SelectedRecording,
            enriched,
            complete && enriched.All(candidate => candidate.ChronologyComplete),
            warnings,
            sourceResolution.SearchDiagnostics);
    }
}
