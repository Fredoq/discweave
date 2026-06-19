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
        ReleaseTrackId id,
        TrackId trackId,
        TrackPosition position,
        IOptionalValue<string> titleOverride)
    {
        Id = id;
        TrackId = trackId;
        Position = position;
        TitleOverride = titleOverride;
    }

    public ReleaseTrackId Id { get; private set; }

    public TrackId TrackId { get; private set; }

    public TrackPosition Position { get; private set; }

    public IOptionalValue<string> TitleOverride { get; private set; }

    public static ReleaseTrack Create(TrackId trackId, TrackPosition position)
    {
        return Create(ReleaseTrackId.New(), trackId, position);
    }

    public static ReleaseTrack Create(ReleaseTrackId id, TrackId trackId, TrackPosition position)
    {
        ArgumentNullException.ThrowIfNull(position);

        return new ReleaseTrack(id, trackId, position, Optional.Missing<string>());
    }

    public static ReleaseTrack Create(TrackId trackId, TrackPosition position, string titleOverride)
    {
        return Create(ReleaseTrackId.New(), trackId, position, titleOverride);
    }

    public static ReleaseTrack Create(ReleaseTrackId id, TrackId trackId, TrackPosition position, string titleOverride)
    {
        ArgumentNullException.ThrowIfNull(position);
        ArgumentNullException.ThrowIfNull(titleOverride);

        return Create(
            id,
            trackId,
            position,
            string.IsNullOrWhiteSpace(titleOverride)
                ? Optional.Missing<string>()
                : Optional.From(titleOverride.Trim()));
    }

    public static ReleaseTrack Create(
        ReleaseTrackId id,
        TrackId trackId,
        TrackPosition position,
        IOptionalValue<string> titleOverride)
    {
        ArgumentNullException.ThrowIfNull(position);
        ArgumentNullException.ThrowIfNull(titleOverride);

        return new ReleaseTrack(id, trackId, position, NormalizeOptionalText(titleOverride));
    }

    public static ReleaseTrack Create(
        TrackId trackId,
        TrackPosition position,
        IOptionalValue<string> titleOverride)
    {
        return Create(ReleaseTrackId.New(), trackId, position, titleOverride);
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
