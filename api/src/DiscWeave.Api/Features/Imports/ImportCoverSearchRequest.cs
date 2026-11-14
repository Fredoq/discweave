namespace DiscWeave.Api.Features.Imports;

public sealed record ImportCoverSearchRequest
{
    public string? Artist { get; init; }

    public string? Title { get; init; }

    public string? CatalogNumber { get; init; }

    public string? Barcode { get; init; }
}
