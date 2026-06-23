using DiscWeave.Domain.Collection;

namespace DiscWeave.Importing;

public sealed record ReleaseFolderScanPayload(
    string SourceRoot,
    IReadOnlyList<ReleaseFolderScanDraft> Drafts,
    int IgnoredFileCount,
    IReadOnlyList<ReleaseFolderLooseFileCandidate> LooseFileCandidates);

public sealed record ReleaseFolderLooseFileCandidate(
    string FilePath,
    string RelativePath,
    AudioFileFormat Format,
    long SizeBytes,
    DateTimeOffset LastModifiedAt,
    string? ContentHash,
    int? DurationSeconds,
    string? Codec,
    AudioFileQuality? Quality,
    int? BitrateKbps,
    int? SampleRateHz,
    int? Channels,
    string? TitleHint,
    IReadOnlyList<string> ArtistHints,
    string? AlbumTitleHint,
    IReadOnlyList<string> AlbumArtistHints,
    int? TrackNumber,
    string Reason);
