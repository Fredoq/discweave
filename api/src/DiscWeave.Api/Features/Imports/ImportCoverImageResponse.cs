using DiscWeave.Application.Catalog.CoverArtwork;

namespace DiscWeave.Api.Features.Imports;

public sealed record ImportCoverImageResponse
{
    public ImportCoverImageResponse(Guid? id, string fileName, string contentType, long sizeBytes, string url, string? sourcePath, CoverArtworkProvenance? provenance = null)
    {
        Id = id;
        FileName = fileName;
        ContentType = contentType;
        SizeBytes = sizeBytes;
        Url = url;
        SourcePath = sourcePath;
        Provenance = provenance;
    }

    public Guid? Id { get; init; }

    public string FileName { get; init; }

    public string ContentType { get; init; }

    public long SizeBytes { get; init; }

    public string Url { get; init; }

    public string? SourcePath { get; init; }

    public CoverArtworkProvenance? Provenance { get; init; }
}
