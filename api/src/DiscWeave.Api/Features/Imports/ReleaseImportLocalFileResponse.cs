namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportLocalFileResponse(
    string FilePath,
    string RelativePath,
    string Format,
    long SizeBytes,
    DateTimeOffset LastModifiedAt,
    string? ContentHash,
    string? Codec,
    string? Quality,
    int? BitrateKbps,
    int? SampleRateHz,
    int? Channels);
