namespace DiscWeave.Application.Catalog.CoverArtwork;

public sealed record CoverReleaseCandidate
{
    public CoverReleaseCandidate(Guid releaseId, string title, IReadOnlyList<string> artists, string? date, string? country, IReadOnlyList<string> formats, IReadOnlyList<string> labels, IReadOnlyList<string> catalogNumbers, string? barcode, string sourceUrl)
    {
        ReleaseId = releaseId;
        Title = title;
        Artists = artists;
        Date = date;
        Country = country;
        Formats = formats;
        Labels = labels;
        CatalogNumbers = catalogNumbers;
        Barcode = barcode;
        SourceUrl = sourceUrl;
    }

    public Guid ReleaseId { get; init; }

    public string Title { get; init; }

    public IReadOnlyList<string> Artists { get; init; }

    public string? Date { get; init; }

    public string? Country { get; init; }

    public IReadOnlyList<string> Formats { get; init; }

    public IReadOnlyList<string> Labels { get; init; }

    public IReadOnlyList<string> CatalogNumbers { get; init; }

    public string? Barcode { get; init; }

    public string SourceUrl { get; init; }
}
