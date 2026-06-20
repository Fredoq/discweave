namespace DiscWeave.Api.Tests;

internal sealed record LocalAudioFileSnapshot(
    Guid Id,
    string Path,
    string? Format,
    long? SizeBytes,
    DateTimeOffset? ModifiedAt,
    string? ContentHash);
