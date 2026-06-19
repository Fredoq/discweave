using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportScanService
{
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
