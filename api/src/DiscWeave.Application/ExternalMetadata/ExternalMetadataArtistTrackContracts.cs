namespace DiscWeave.Application.ExternalMetadata;

public sealed record ExternalMetadataArtistCandidate(
    ExternalMetadataSource Source,
    string Name,
    string? Profile,
    IReadOnlyList<string> NameVariations);

public sealed record ExternalMetadataArtistDetail(
    ExternalMetadataSource Source,
    string Name,
    string? RealName,
    string? Profile,
    IReadOnlyList<string> Aliases,
    IReadOnlyList<string> Members,
    IReadOnlyList<string> NameVariations);

public sealed record ExternalMetadataReleaseContext(
    ExternalMetadataSource Source,
    string Title,
    int? Year,
    IReadOnlyList<string> Artists,
    IReadOnlyList<ExternalMetadataArtistReference>? ArtistReferences = null);

public sealed record ExternalMetadataTrackCandidate(
    ExternalMetadataSource Source,
    string Title,
    string? Position,
    TimeSpan? Duration,
    IReadOnlyList<string> Artists,
    ExternalMetadataReleaseContext Release);

public sealed record ExternalMetadataTrackDetail(
    ExternalMetadataSource Source,
    string Title,
    string? Position,
    TimeSpan? Duration,
    IReadOnlyList<string> Artists,
    IReadOnlyList<ExternalMetadataTrackCredit> Credits,
    ExternalMetadataReleaseContext Release);

public sealed record ExternalMetadataTrackCredit(
    string Name,
    string Role);
