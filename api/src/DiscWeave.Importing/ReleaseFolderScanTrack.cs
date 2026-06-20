using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;

namespace DiscWeave.Importing;

public sealed record ReleaseFolderScanTrack(
    string FilePath,
    string RelativePath,
    AudioFileFormat Format,
    long SizeBytes,
    DateTimeOffset LastModifiedAt,
    string? ContentHash,
    string? Codec,
    AudioFileQuality? Quality,
    TimeSpan? Duration,
    int? BitrateKbps,
    int? SampleRateHz,
    int? Channels,
    int? Position,
    string? Disc,
    string? Side,
    string Title,
    IReadOnlyList<string> ArtistNames,
    IReadOnlyList<ImportReviewIssue> Issues);
