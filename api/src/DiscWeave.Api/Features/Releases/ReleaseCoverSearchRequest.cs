namespace DiscWeave.Api.Features.Releases;

public sealed record ReleaseCoverSearchRequest
{
    public string? Artist { get; init; }

    public string? Title { get; init; }

    public string? CatalogNumber { get; init; }

    public string? Barcode { get; init; }
}
