namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportEndpointTests
{
    private static object LooseAudioFileWithTags(
        string rootPath,
        string audioPath,
        string contentHash,
        string title,
        string[]? artists = null,
        string albumTitle = "",
        string[]? albumArtists = null,
        int? trackNumber = null)
    {
        string[] emptyNames = [];
        return new
        {
            filePath = audioPath,
            relativePath = Path.GetRelativePath(rootPath, audioPath),
            format = "flac",
            contentHash,
            sizeBytes = 9,
            lastModifiedAt = DateTimeOffset.UtcNow,
            audioMetadata = new
            {
                title,
                artists = artists ?? emptyNames,
                albumTitle,
                albumArtists = albumArtists ?? emptyNames,
                catalogNumber = (string?)null,
                releaseDate = (string?)null,
                year = (int?)null,
                durationSeconds = 123,
                trackNumber,
                codec = "FLAC",
                container = "flac",
                lossless = true,
                bitrateKbps = 900,
                sampleRateHz = 44100,
                channels = 2
            },
            coverArtifact = (object?)null
        };
    }
}
