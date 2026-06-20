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
        string? codec = null,
        AudioFileQuality? quality = null,
        int? bitrateKbps = null,
        int? sampleRateHz = null,
        int? channels = null)
    {
        ArgumentNullException.ThrowIfNull(contentHash);

        FilePath = filePath;
        RelativePath = relativePath;
        Format = format;
        SizeBytes = sizeBytes;
        LastModifiedAt = lastModifiedAt;
        ContentHash = contentHash;
        Codec = codec;
        Quality = quality;
        BitrateKbps = bitrateKbps;
        SampleRateHz = sampleRateHz;
        Channels = channels;
    }

    public string FilePath { get; }

    public string RelativePath { get; }

    public AudioFileFormat Format { get; }

    public long SizeBytes { get; }

    public DateTimeOffset LastModifiedAt { get; }

    public IOptionalValue<string> ContentHash { get; }

    public string? Codec { get; }

    public AudioFileQuality? Quality { get; }

    public int? BitrateKbps { get; }

    public int? SampleRateHz { get; }

    public int? Channels { get; }
}
