namespace DiscWeave.Api.Features.LocalFiles;

public sealed record UpdateLocalAudioFileRequest(
    string? Path,
    string? Format,
    string? Codec,
    string? Quality,
    long? SizeBytes,
    DateTimeOffset? LastModifiedAt,
    string? ContentHash,
    int? DurationSeconds,
    int? BitrateKbps,
    int? SampleRateHz,
    int? Channels);

public sealed record LocalAudioFileResponse(
    Guid Id,
    string Path,
    string? Format,
    string? Codec,
    string? Quality,
    long? SizeBytes,
    DateTimeOffset? ModifiedAt,
    string? ContentHash,
    int? DurationSeconds,
    int? BitrateKbps,
    int? SampleRateHz,
    int? Channels);

internal sealed record LocalAudioFileFields(
    Guid Id,
    string Path,
    string? Format,
    string? Codec,
    string? Quality,
    long? SizeBytes,
    DateTimeOffset? ModifiedAt,
    string? ContentHash,
    int? DurationSeconds,
    int? BitrateKbps,
    int? SampleRateHz,
    int? Channels);
