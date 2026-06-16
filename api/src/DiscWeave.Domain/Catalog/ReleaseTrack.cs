using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Catalog;

public sealed class ReleaseTrack
{
    private ReleaseTrack()
    {
        Position = TrackPosition.Empty;
        TitleOverride = Optional.Missing<string>();
    }

    private ReleaseTrack(
        TrackId trackId,
        TrackPosition position,
        IOptionalValue<string> titleOverride)
    {
        TrackId = trackId;
        Position = position;
        TitleOverride = titleOverride;
    }

    public TrackId TrackId { get; private set; }

    public TrackPosition Position { get; private set; }

    public IOptionalValue<string> TitleOverride { get; private set; }

    public static ReleaseTrack Create(TrackId trackId, TrackPosition position)
    {
        ArgumentNullException.ThrowIfNull(position);

        return new ReleaseTrack(trackId, position, Optional.Missing<string>());
    }

    public static ReleaseTrack Create(TrackId trackId, TrackPosition position, string titleOverride)
    {
        ArgumentNullException.ThrowIfNull(position);
        ArgumentNullException.ThrowIfNull(titleOverride);

        return Create(
            trackId,
            position,
            string.IsNullOrWhiteSpace(titleOverride)
                ? Optional.Missing<string>()
                : Optional.From(titleOverride.Trim()));
    }

    public static ReleaseTrack Create(
        TrackId trackId,
        TrackPosition position,
        IOptionalValue<string> titleOverride)
    {
        ArgumentNullException.ThrowIfNull(position);
        ArgumentNullException.ThrowIfNull(titleOverride);

        return new ReleaseTrack(trackId, position, NormalizeOptionalText(titleOverride));
    }

    private static IOptionalValue<string> NormalizeOptionalText(IOptionalValue<string> value)
    {
        if (!value.HasValue)
        {
            return Optional.Missing<string>();
        }

        string text = value.Match(static present => present.Trim(), static () => string.Empty);
        return text.Length == 0
            ? Optional.Missing<string>()
            : Optional.From(text);
    }
}
