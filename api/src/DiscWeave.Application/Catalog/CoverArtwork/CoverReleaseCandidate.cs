namespace DiscWeave.Application.Catalog.CoverArtwork;

public sealed record CoverReleaseCandidate
{
    public CoverReleaseCandidate(Guid releaseId, string title, IReadOnlyList<string> artists, string sourceUrl)
    {
        ReleaseId = releaseId;
        Title = title;
        Artists = artists;
        SourceUrl = sourceUrl;
    }

    public Guid ReleaseId { get; init; }

    public string Title { get; init; }

    public IReadOnlyList<string> Artists { get; init; }

    public string? Date { get; init; }

    public string? Country { get; init; }

    public IReadOnlyList<string> Formats { get; init; } = [];

    public IReadOnlyList<string> Labels { get; init; } = [];

    public IReadOnlyList<string> CatalogNumbers { get; init; } = [];

    public string? Barcode { get; init; }

    public string SourceUrl { get; init; }
}
