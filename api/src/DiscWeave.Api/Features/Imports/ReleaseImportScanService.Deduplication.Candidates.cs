using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportScanService
{
    private static async Task<Dictionary<ReleaseId, DuplicateTrackCandidate[]>> LoadReleaseTrackCandidatesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseId[] releaseIds,
        CancellationToken cancellationToken)
    {
        if (releaseIds.Length == 0)
        {
            return [];
        }

        Release[] releases = await context.Releases.AsNoTracking()
            .Include(release => release.Tracklist)
            .Where(release => release.CollectionId == collectionId && releaseIds.Contains(release.Id))
            .ToArrayAsync(cancellationToken);
        TrackId[] trackIds =
        [
            .. releases
                .SelectMany(release => release.Tracklist)
                .Select(track => track.TrackId)
                .Distinct()
        ];
        Dictionary<TrackId, string> titlesByTrackId = trackIds.Length == 0
            ? []
            : await context.Tracks.AsNoTracking()
                .Where(track => track.CollectionId == collectionId && trackIds.Contains(track.Id))
                .ToDictionaryAsync(track => track.Id, track => track.Title, cancellationToken);

        return releases.ToDictionary(
            release => release.Id,
            release => release.Tracklist
                    .OrderBy(track => track.Position.Number)
                    .Select(track => new DuplicateTrackCandidate(
                        track.TrackId,
                        track.Position.Number,
                        TrackTitle(track, titlesByTrackId)))
                    .ToArray());
    }

    private static TrackId? SelectDuplicateTrackId(
        ReleaseImportDraftTrack track,
        IReadOnlyList<DuplicateTrackCandidate> candidates)
    {
        TrackId[] distinctTrackIds = [.. candidates.Select(candidate => candidate.TrackId).Distinct()];
        if (distinctTrackIds.Length == 1)
        {
            return distinctTrackIds[0];
        }

        if (track.Position is { } position)
        {
            TrackId[] positionMatches =
            [
                .. candidates
                    .Where(candidate => candidate.Position == position)
                    .Select(candidate => candidate.TrackId)
                    .Distinct()
            ];
            if (positionMatches.Length == 1)
            {
                return positionMatches[0];
            }
        }

        string normalizedTitle = NormalizeTitle(track.Title);
        if (normalizedTitle.Length > 0)
        {
            TrackId[] titleMatches =
            [
                .. candidates
                    .Where(candidate => NormalizeTitle(candidate.Title) == normalizedTitle)
                    .Select(candidate => candidate.TrackId)
                    .Distinct()
            ];
            if (titleMatches.Length == 1)
            {
                return titleMatches[0];
            }
        }

        return null;
    }

    private static DuplicateTrackCandidate[] DistinctCandidates(IReadOnlyList<DuplicateTrackCandidate> candidates)
    {
        return
        [
            .. candidates
                .DistinctBy(candidate => (candidate.TrackId, candidate.Position, candidate.Title))
                .OrderBy(candidate => candidate.Position)
                .ThenBy(candidate => candidate.Title, StringComparer.OrdinalIgnoreCase)
                .ThenBy(candidate => candidate.TrackId.Value)
        ];
    }

    private static string TrackTitle(ReleaseTrack releaseTrack, Dictionary<TrackId, string> titlesByTrackId)
    {
        return releaseTrack.TitleOverride is { HasValue: true } titleOverride
            ? titleOverride.Match(static value => value, static () => string.Empty)
            : titlesByTrackId.TryGetValue(releaseTrack.TrackId, out string? title) ? title : string.Empty;
    }

    private static string NormalizeTitle(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim().ToLowerInvariant();
    }

    private static string? NormalizeContentHash(IOptionalValue<string> value)
    {
        return value is PresentOptionalValue<string> present ? NormalizeContentHash(present.Value) : null;
    }

    private sealed record DuplicateTrackCandidate(TrackId TrackId, int Position, string Title);
}
