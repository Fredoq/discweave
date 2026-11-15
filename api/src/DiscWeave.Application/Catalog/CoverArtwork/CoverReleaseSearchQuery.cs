namespace DiscWeave.Application.Catalog.CoverArtwork;

public sealed record CoverReleaseSearchQuery
{
    public CoverReleaseSearchQuery(string artist, string title, string? catalogNumber = null, string? barcode = null)
    {
        Artist = artist;
        Title = title;
        CatalogNumber = catalogNumber;
        Barcode = barcode;
    }

    public string Artist { get; init; }

    public string Title { get; init; }

    public string? CatalogNumber { get; init; }

    public string? Barcode { get; init; }
}
