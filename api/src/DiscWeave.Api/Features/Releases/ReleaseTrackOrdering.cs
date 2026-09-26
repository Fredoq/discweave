using System.Globalization;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Api.Features.Releases;

internal static class ReleaseTrackOrdering
{
    private static readonly StringComparer DiscComparer = StringComparer.Create(
        CultureInfo.InvariantCulture, CompareOptions.IgnoreCase | CompareOptions.NumericOrdering);

    public static IOrderedEnumerable<ReleaseTrack> ByPosition(IEnumerable<ReleaseTrack> tracks)
    {
        return ByPosition(tracks, static track => track.Position);
    }

    public static IOrderedEnumerable<T> ByPosition<T>(IEnumerable<T> tracks, Func<T, TrackPosition> position)
    {
        return tracks
            .OrderBy(track => string.IsNullOrEmpty(Marker(position(track).Disc)) ? 1 : 0)
            .ThenBy(track => Marker(position(track).Disc), DiscComparer)
            .ThenBy(track => Marker(position(track).Disc), StringComparer.OrdinalIgnoreCase)
            .ThenBy(track => string.IsNullOrEmpty(Marker(position(track).Side)) ? 1 : 0)
            .ThenBy(track => Marker(position(track).Side), StringComparer.OrdinalIgnoreCase)
            .ThenBy(track => position(track).Number);
    }

    private static string Marker(IOptionalValue<string>? marker)
    {
        return marker?.Match(static value => value, static () => string.Empty) ?? string.Empty;
    }
}
