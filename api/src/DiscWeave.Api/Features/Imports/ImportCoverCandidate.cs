namespace DiscWeave.Api.Features.Imports;

public sealed record ImportCoverCandidate
{
    public ImportCoverCandidate(Guid id, string fileName, string extension, string contentType, string? sourcePath, long sizeBytes, string version)
    {
        Id = id;
        FileName = fileName;
        Extension = extension;
        ContentType = contentType;
        SourcePath = sourcePath;
        SizeBytes = sizeBytes;
        Version = version;
    }

    public Guid Id { get; init; }

    public string FileName { get; init; }

    public string Extension { get; init; }

    public string ContentType { get; init; }

    public string? SourcePath { get; init; }

    public long SizeBytes { get; init; }

    public string Version { get; init; }
}
