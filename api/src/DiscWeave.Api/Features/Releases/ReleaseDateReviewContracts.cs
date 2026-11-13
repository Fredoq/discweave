using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Features.Releases;

public sealed record ReleaseDatePreviewRequest(string DiscogsReleaseId);
public sealed record ReleaseDateApplyRequest(string Token, bool Confirmed = false);

public sealed record ReleaseDatePreviewResponse(
    string? Token,
    int? CurrentYear,
    string? CurrentDate,
    string CurrentTitle,
    IReadOnlyList<string> CurrentArtists,
    IReadOnlyList<string> CurrentCatalogNumbers,
    IReadOnlyList<string> CurrentLabels,
    ExternalMetadataSource Source,
    string Title,
    IReadOnlyList<string> Artists,
    string? CatalogNumber,
    IReadOnlyList<string> Labels,
    IReadOnlyList<string> Formats,
    object? Date);

internal sealed record ReleaseDatePreviewToken(
    Guid CollectionId,
    Guid ReleaseId,
    string Fingerprint,
    DateOnly Date);
