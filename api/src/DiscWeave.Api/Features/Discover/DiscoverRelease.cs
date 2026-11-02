namespace DiscWeave.Api.Features.Discover;

public sealed record DiscoverRelease(
    string ExternalId,
    string Title,
    IReadOnlyList<string> Artists,
    int? Year,
    IReadOnlyList<string> Labels,
    IReadOnlyList<string> Genres,
    IReadOnlyList<string> Formats,
    string SourceUrl,
    string Attribution,
    string Reason,
    string AppleMusicSearchUrl);
