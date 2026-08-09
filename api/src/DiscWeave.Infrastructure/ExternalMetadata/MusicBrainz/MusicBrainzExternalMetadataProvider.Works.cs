using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Caching;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    private const string WorkContextWarning = "musicbrainz.work_context_incomplete";

    internal Task<ExternalMetadataResult<WorkPerformanceOutcome>> GetWorkPerformancesAsync(
        string workMbid,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        return TryNormalizeMbid(workMbid, out string normalized)
            ? GetWorkDetailCoreAsync(normalized, context, cancellationToken)
            : Task.FromResult(Failure<WorkPerformanceOutcome>(InvalidResponse()));
    }

    private async Task<ExternalMetadataResult<WorkPerformanceOutcome>> GetWorkDetailCoreAsync(
        string workMbid,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        ExternalMetadataCacheKey key = MbidKey("work-detail", workMbid);
        return await GetOrCreateWithOperationAsync(
            key,
            DetailTtl,
            NotFoundTtl,
            async _ =>
            {
                ExternalMetadataResult<WorkDto> raw = await SendAsync<WorkDto>(
                    WorkDetailPath(workMbid),
                    context).ConfigureAwait(false);
                return raw.IsSuccess && TryMapWorkDetail(raw.Value, workMbid, out WorkPerformanceOutcome mapped)
                    ? new ExternalMetadataResult<WorkPerformanceOutcome>(mapped)
                    : raw.IsSuccess
                        ? Failure<WorkPerformanceOutcome>(InvalidResponse())
                        : Failure<WorkPerformanceOutcome>(raw.Error);
            },
            context,
            cancellationToken).ConfigureAwait(false);
    }

    private static bool TryMapWorkDetail(
        WorkDto response,
        string expectedMbid,
        out WorkPerformanceOutcome outcome)
    {
        if (!TryNormalizeMbid(response.Id, out string mbid) ||
            !string.Equals(mbid, expectedMbid, StringComparison.Ordinal))
        {
            outcome = null!;
            return false;
        }

        var warnings = new List<string>();
        WorkRecordingHypothesis[] recordings =
        [
            .. (response.Relations ?? [])
                .Where(relation =>
                    string.Equals(relation.TargetType, "recording", StringComparison.OrdinalIgnoreCase))
                .Select(relation => relation.Recording)
                .Where(recording =>
                    recording is not null &&
                    TryNormalizeMbid(recording.Id, out _) &&
                    !string.IsNullOrWhiteSpace(recording.Title))
                .Select(recording => new WorkRecordingHypothesis(
                    NormalizeRequiredMbid(recording!.Id!),
                    recording.Title!.Trim()))
                .DistinctBy(recording => recording.Mbid, StringComparer.Ordinal)
        ];
        if ((response.Relations ?? []).Any(relation =>
                string.Equals(relation.TargetType, "recording", StringComparison.OrdinalIgnoreCase) &&
                (relation.Recording is null ||
                    !TryNormalizeMbid(relation.Recording.Id, out _) ||
                    string.IsNullOrWhiteSpace(relation.Recording.Title))))
        {
            warnings.Add(WorkContextWarning);
        }

        outcome = new WorkPerformanceOutcome(
            mbid,
            EmptyToNull(response.Title),
            recordings,
            warnings.Count == 0,
            warnings);
        return true;
    }

    private static string NormalizeRequiredMbid(string value)
    {
        return TryNormalizeMbid(value, out string normalized)
            ? normalized
            : throw new InvalidOperationException("A validated MusicBrainz MBID was expected.");
    }
}
