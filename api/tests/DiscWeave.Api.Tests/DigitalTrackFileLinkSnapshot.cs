namespace DiscWeave.Api.Tests;

internal sealed record DigitalTrackFileLinkSnapshot(
    Guid Id,
    Guid DigitalOwnedItemId,
    Guid ReleaseTrackId,
    Guid LocalAudioFileId);
