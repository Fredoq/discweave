using DiscWeave.Api.Features.ExternalSources;

namespace DiscWeave.Api.Features.Tracks;

public sealed record TrackResponse(
    Guid Id,
    string Title,
    int? DurationSeconds,
    int? VersionYear,
    bool IsOriginal,
    IReadOnlyList<string> Genres,
    IReadOnlyList<string> Tags,
    IReadOnlyList<ExternalSourceReferenceResponse> ExternalSources,
    IReadOnlyList<TrackCreditResponse> Credits,
    IReadOnlyList<TrackReleaseAppearanceResponse> ReleaseAppearances,
    IReadOnlyList<TrackDigitalFileResponse> DigitalFiles);

public sealed record TrackCreditResponse(Guid ArtistId, string ArtistName, string Role, IReadOnlyList<string> Roles);

public sealed record TrackReleaseAppearanceResponse(
    Guid ReleaseId,
    string ReleaseTitle,
    string ReleaseArtist,
    int? Year,
    string? Label,
    int Position,
    string? Disc,
    string? Side,
    int? DurationSeconds);

public sealed record TrackDigitalFileResponse(
    Guid DigitalTrackFileLinkId,
    Guid LocalAudioFileId,
    Guid DigitalOwnedItemId,
    Guid ReleaseId,
    string ReleaseTitle,
    string ReleaseArtist,
    int? ReleaseYear,
    string? ReleaseDate,
    string? ReleaseLabel,
    string? ReleaseCatalogNumber,
    Guid ReleaseTrackId,
    int Position,
    string? Disc,
    string? Side,
    string Path,
    string? Format,
    string? Codec,
    string? Quality,
    long? SizeBytes,
    DateTimeOffset? ModifiedAt,
    string? ContentHash,
    int? DurationSeconds,
    int? BitrateKbps,
    int? SampleRateHz,
    int? Channels);
