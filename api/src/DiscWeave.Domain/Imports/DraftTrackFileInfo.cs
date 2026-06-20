using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Imports;

public sealed record DraftTrackFileInfo
{
    public DraftTrackFileInfo(
        string filePath,
        string relativePath,
        AudioFileFormat format,
        long sizeBytes,
        DateTimeOffset lastModifiedAt,
        IOptionalValue<string> contentHash,
        DraftTrackFileMetadata metadata)
    {
        ArgumentNullException.ThrowIfNull(contentHash);
        ArgumentNullException.ThrowIfNull(metadata);

        FilePath = filePath;
        RelativePath = relativePath;
        Format = format;
        SizeBytes = sizeBytes;
        LastModifiedAt = lastModifiedAt;
        ContentHash = contentHash;
        Metadata = metadata;
    }

    public string FilePath { get; }

    public string RelativePath { get; }

    public AudioFileFormat Format { get; }

    public long SizeBytes { get; }

    public DateTimeOffset LastModifiedAt { get; }

    public IOptionalValue<string> ContentHash { get; }

    public DraftTrackFileMetadata Metadata { get; }
}
