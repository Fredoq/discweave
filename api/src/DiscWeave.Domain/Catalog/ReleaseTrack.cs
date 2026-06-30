using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Domain.SharedKernel.Validation;
using System.Text.Json;

namespace DiscWeave.Domain.Catalog;

public sealed class ReleaseTrack
{
    private static readonly JsonSerializerOptions ArtistCreditJsonOptions = new(JsonSerializerDefaults.Web);
    private string _artistCreditsJson = "[]";

    private ReleaseTrack()
    {
        Position = TrackPosition.Empty;
        Details = TrackDetails.Empty;
        TitleOverride = Optional.Missing<string>();
    }

    private ReleaseTrack(
        ReleaseTrackId id,
        TrackId? trackId,
        TrackPosition position,
        TrackDetails details,
        IOptionalValue<string> titleOverride)
    {
        Id = id;
        TrackId = trackId;
        Position = position;
        Details = details;
        TitleOverride = titleOverride;
    }

    public ReleaseTrackId Id { get; private set; }

    public CollectionId CollectionId { get; private set; }

    public ReleaseId ReleaseId { get; private set; }

    public TrackId? TrackId { get; private set; }

    public bool IsReleaseOnly => TrackId is null;

    public TrackPosition Position { get; private set; }

    public TrackDetails Details { get; private set; }

    public IOptionalValue<string> TitleOverride { get; private set; }

    public IReadOnlyList<ReleaseTrackArtistCredit> ArtistCredits => DeserializeArtistCredits(_artistCreditsJson);

    public static ReleaseTrack Create(TrackId trackId, TrackPosition position)
    {
        return Create(ReleaseTrackId.New(), trackId, position);
    }

    public static ReleaseTrack Create(ReleaseTrackId id, TrackId trackId, TrackPosition position)
    {
        ArgumentNullException.ThrowIfNull(position);

        return new ReleaseTrack(id, trackId, position, TrackDetails.Empty, Optional.Missing<string>());
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

        return new ReleaseTrack(id, trackId, position, TrackDetails.Empty, NormalizeOptionalText(titleOverride));
    }

    public static ReleaseTrack Create(
        TrackId trackId,
        TrackPosition position,
        IOptionalValue<string> titleOverride)
    {
        return Create(ReleaseTrackId.New(), trackId, position, titleOverride);
    }

    public static ReleaseTrack CreateReleaseOnly(ReleaseTrackId id, TrackPosition position, string title, TrackDetails details)
    {
        ArgumentNullException.ThrowIfNull(position);
        ArgumentNullException.ThrowIfNull(title);
        ArgumentNullException.ThrowIfNull(details);

        string normalizedTitle = Guard.RequiredText(title, nameof(title), "release_track.title_required");
        return new ReleaseTrack(id, null, position, details, Optional.From(normalizedTitle));
    }

    public ReleaseTrack UpdatePlacement(TrackPosition position, IOptionalValue<string> titleOverride)
    {
        ArgumentNullException.ThrowIfNull(position);
        ArgumentNullException.ThrowIfNull(titleOverride);

        Position = position;
        TitleOverride = NormalizeOptionalText(titleOverride);
        return this;
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

    public ReleaseTrack WithArtistCredits(IReadOnlyList<ReleaseTrackArtistCredit> artistCredits)
    {
        _artistCreditsJson = SerializeArtistCredits(artistCredits);
        return this;
    }

    private static string SerializeArtistCredits(IReadOnlyList<ReleaseTrackArtistCredit>? artistCredits)
    {
        ReleaseTrackArtistCreditStorageModel[] storage =
        [
            .. (artistCredits ?? [])
                .Select(credit => ReleaseTrackArtistCredit.Create(credit.ArtistId, credit.Roles))
                .Where(credit => credit.Roles.Count > 0)
                .GroupBy(credit => credit.ArtistId)
                .Select(group => new ReleaseTrackArtistCreditStorageModel(
                    group.Key.Value,
                    [.. group.SelectMany(credit => credit.Roles).Distinct(StringComparer.Ordinal)]))
        ];

        return JsonSerializer.Serialize(storage, ArtistCreditJsonOptions);
    }

    private static IReadOnlyList<ReleaseTrackArtistCredit> DeserializeArtistCredits(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        ReleaseTrackArtistCreditStorageModel[] storage =
            JsonSerializer.Deserialize<ReleaseTrackArtistCreditStorageModel[]>(json, ArtistCreditJsonOptions) ?? [];

        return
        [
            .. storage.Select(credit => ReleaseTrackArtistCredit.Create(
                new ArtistId(credit.ArtistId),
                credit.Roles))
        ];
    }

    internal void AttachToRelease(CollectionId collectionId, ReleaseId releaseId)
    {
        CollectionId = collectionId;
        ReleaseId = releaseId;
    }

    private sealed record ReleaseTrackArtistCreditStorageModel(Guid ArtistId, string[] Roles);
}
