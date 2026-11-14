namespace DiscWeave.Application.Catalog.CoverArtwork;

public sealed record CoverArtworkProvenance
{
    public CoverArtworkProvenance(string provider, Guid releaseId, string imageId, string sourceUrl, DateTimeOffset downloadedAt, string sha256)
    {
        Provider = provider;
        ReleaseId = releaseId;
        ImageId = imageId;
        SourceUrl = sourceUrl;
        DownloadedAt = downloadedAt;
        Sha256 = sha256;
    }

    public string Provider { get; init; }

    public Guid ReleaseId { get; init; }

    public string ImageId { get; init; }

    public string SourceUrl { get; init; }

    public DateTimeOffset DownloadedAt { get; init; }

    public string Sha256 { get; init; }
}
