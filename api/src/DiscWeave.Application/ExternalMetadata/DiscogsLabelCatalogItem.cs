namespace DiscWeave.Application.ExternalMetadata;

public sealed record DiscogsLabelCatalogItem
{
    public DiscogsLabelCatalogItem(string externalId, string catalogNumber, string artist, string title, int year, string format)
    {
        ExternalId = externalId;
        CatalogNumber = catalogNumber;
        Artist = artist;
        Title = title;
        Year = year;
        Format = format;
    }

    public string ExternalId { get; init; }

    public string CatalogNumber { get; init; }

    public string Artist { get; init; }

    public string Title { get; init; }

    public int Year { get; init; }

    public string Format { get; init; }
}
