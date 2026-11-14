namespace DiscWeave.Application.Catalog.CoverArtwork;

public sealed record DownloadedCoverArtwork
{
    public DownloadedCoverArtwork(byte[] content, string contentType, string extension, string fileName, CoverArtworkProvenance provenance)
    {
        Content = content;
        ContentType = contentType;
        Extension = extension;
        FileName = fileName;
        Provenance = provenance;
    }

    public byte[] Content { get; init; }

    public string ContentType { get; init; }

    public string Extension { get; init; }

    public string FileName { get; init; }

    public CoverArtworkProvenance Provenance { get; init; }
}
