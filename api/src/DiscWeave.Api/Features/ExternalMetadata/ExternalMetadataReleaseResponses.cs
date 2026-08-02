using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Features.ExternalMetadata;

public sealed record ExternalMetadataSearchResponse<T>(
    IReadOnlyList<T> Items,
    int Limit,
    int Total,
    int Page = 1);

public sealed record ExternalMetadataReleaseCandidateResponse(
    ExternalMetadataSource Source,
    string Title,
    IReadOnlyList<string> Artists,
    int? Year,
    IReadOnlyList<string> Labels,
    IReadOnlyList<string> Formats,
    string? CatalogNumber,
    int? TrackCount,
    IReadOnlyList<string> Barcodes);

public sealed record ExternalMetadataReleaseDetailResponse(
    ExternalMetadataSource Source,
    string Title,
    IReadOnlyList<string> Artists,
    int? Year,
    object? ReleaseDateEvidence,
    bool TracklistComplete,
    IReadOnlyList<string> Labels,
    IReadOnlyList<string> Formats,
    IReadOnlyList<ExternalMetadataReleaseTrackResponse> Tracklist,
    IReadOnlyList<ExternalMetadataReleaseIdentifierResponse> Identifiers,
    IReadOnlyList<string> Barcodes,
    string? CatalogNumber,
    IReadOnlyList<ExternalMetadataReleaseCreditResponse> Credits,
    ExternalMetadataReleaseDraftResponse Draft,
    IReadOnlyList<ExternalMetadataReleaseDraftProviderReferenceResponse> RelatedSources);

public sealed record ExternalMetadataReleaseTrackResponse(
    string Title,
    string? Position,
    string? Disc,
    string? Side,
    int? DurationSeconds,
    IReadOnlyList<string> Artists,
    IReadOnlyList<ExternalMetadataReleaseDraftProviderReferenceResponse> ExternalSources);

public sealed record ExternalMetadataReleaseIdentifierResponse(
    string Type,
    string Value);

public sealed record ExternalMetadataReleaseCreditResponse(
    string Name,
    string Role,
    string? TrackTitle,
    string? TrackPosition);

public sealed record ExternalMetadataReleaseDraftResponse(
    string Title,
    string? Type,
    IReadOnlyList<string> Genres,
    int? Year,
    string? ReleaseDate,
    IReadOnlyList<ExternalMetadataReleaseDraftArtistCreditResponse> ArtistCredits,
    IReadOnlyList<ExternalMetadataReleaseDraftLabelResponse> Labels,
    IReadOnlyList<ExternalMetadataReleaseDraftTrackResponse> Tracklist,
    IReadOnlyList<ExternalMetadataReleaseDraftProviderReferenceResponse> ExternalSources);

public sealed record ExternalMetadataReleaseDraftArtistCreditResponse(
    string Name,
    string Role,
    ExternalMetadataDraftExternalSourceResponse? ExternalSource = null);

public sealed record ExternalMetadataReleaseDraftLabelResponse(
    string Name,
    string? CatalogNumber,
    bool HasNoCatalogNumber);

public sealed record ExternalMetadataReleaseDraftTrackResponse(
    string Title,
    int Position,
    string? Disc,
    string? Side,
    int? DurationSeconds,
    IReadOnlyList<ExternalMetadataReleaseDraftArtistCreditResponse> ArtistCredits,
    IReadOnlyList<ExternalMetadataReleaseDraftProviderReferenceResponse> ExternalSources);

public sealed record ExternalMetadataReleaseDraftProviderReferenceResponse(
    string ProviderCode,
    string ResourceType,
    string ExternalId,
    string SourceUrl);

public sealed record ExternalMetadataDraftExternalSourceResponse(
    string ProviderName,
    string ResourceType,
    string ExternalId,
    string SourceUrl);
