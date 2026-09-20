using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Api.Features.Releases;

internal static class ReleaseTrackOrdering
{
    public static IOrderedEnumerable<ReleaseTrack> ByPosition(IEnumerable<ReleaseTrack> tracks)
    {
        return tracks
            .OrderBy(track => string.IsNullOrEmpty(Marker(track.Position.Disc)) ? 1 : 0)
            .ThenBy(track => Marker(track.Position.Disc), StringComparer.OrdinalIgnoreCase)
            .ThenBy(track => string.IsNullOrEmpty(Marker(track.Position.Side)) ? 1 : 0)
            .ThenBy(track => Marker(track.Position.Side), StringComparer.OrdinalIgnoreCase)
            .ThenBy(track => track.Position.Number);
    }

    private static string Marker(IOptionalValue<string>? marker)
    {
        return marker?.Match(static value => value, static () => string.Empty) ?? string.Empty;
    }
}
