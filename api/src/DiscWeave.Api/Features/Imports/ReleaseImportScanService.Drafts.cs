using System.Globalization;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Importing;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportScanService
{
    private static ReleaseFolderScanDraft CreateDraft(
        string sourceRoot,
        string releaseRootRelativePath,
        IReadOnlyList<DesktopScanFile> audioFiles,
        IReadOnlyList<DesktopScanFile> coverFiles,
        DraftParsers parsers)
    {
        string releaseFolderName = string.IsNullOrWhiteSpace(releaseRootRelativePath)
            ? Path.GetFileName(sourceRoot)
            : LastSegment(releaseRootRelativePath);
        string sourcePath = string.IsNullOrWhiteSpace(releaseRootRelativePath)
            ? sourceRoot
            : Path.Combine(sourceRoot, releaseRootRelativePath);

        ParsedReleaseFolder parsed = ReleaseFolderNameParser.Parse(releaseFolderName, parsers.ReleaseTemplates);
        DesktopAudioMetadataRequest releaseTags = FirstReleaseTags(audioFiles);
        ImportDateResult releaseDate = ParseReleaseDate(releaseTags.ReleaseDate);
        int? taggedYear = releaseTags.Year is >= 1000 and <= 9999 ? releaseTags.Year : null;
        int? year = taggedYear ?? releaseDate.Year ?? parsed.Year ?? ParentFolderYear(sourceRoot, releaseRootRelativePath);
        IReadOnlyList<ImportReviewIssue> yearIssues = releaseTags.Year is not null && taggedYear is null
            ? [new ImportReviewIssue(ImportIssueCodes.InvalidReleaseYear, "Audio metadata year is not a four-digit year and was ignored")]
            : [];
        CoverSelection cover = SelectCover(releaseRootRelativePath, coverFiles);

        IReadOnlyList<string> releaseArtistNames = CleanNames(releaseTags.AlbumArtists);
        bool tagsAreVariousArtists = releaseArtistNames.Count == 1 && ImportArtistNames.IsVariousArtistsName(releaseArtistNames[0]);
        bool isVariousArtists = tagsAreVariousArtists || (releaseArtistNames.Count == 0 && parsed.IsVariousArtists);
        if (tagsAreVariousArtists)
        {
            releaseArtistNames = [];
        }

        return new ReleaseFolderScanDraft(
            sourcePath,
            releaseRootRelativePath,
            ReleaseAlbumTitle(audioFiles, releaseTags) ?? parsed.Title ?? releaseFolderName,
            isVariousArtists ? "compilation" : "unknown",
            TrimOrNull(releaseTags.CatalogNumber) ?? parsed.CatalogNumber,
            null,
            releaseDate.ReleaseDate ?? parsed.ReleaseDate,
            year,
            isVariousArtists,
            false,
            cover.File?.FilePath,
            releaseArtistNames.Count > 0 ? releaseArtistNames : parsed.ArtistNames,
            [],
            [],
            [],
            [.. parsed.Issues.Concat(releaseDate.Issues).Concat(yearIssues).Concat(cover.Issues)],
            cover.Artifact,
            [.. audioFiles.Select(file => CreateTrack(sourcePath, file, parsers))]);
    }

    private static int? ParentFolderYear(string sourceRoot, string releaseRootRelativePath)
    {
        string[] parentSegments =
        [
            .. NormalizeRelativePath(DirectoryRelativePath(releaseRootRelativePath))
                .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        ];

        for (int index = parentSegments.Length - 1; index >= 0; index--)
        {
            if (TryParseYearFolder(parentSegments[index], out int year))
            {
                return year;
            }
        }

        return !string.IsNullOrWhiteSpace(releaseRootRelativePath) &&
            TryParseYearFolder(Path.GetFileName(sourceRoot), out int sourceRootYear)
            ? sourceRootYear
            : null;
    }

    private static bool TryParseYearFolder(string? segment, out int year)
    {
        year = default;
        if (string.IsNullOrWhiteSpace(segment))
        {
            return false;
        }

        string trimmed = segment.Trim();
        return trimmed.Length == 4 &&
            int.TryParse(trimmed, NumberStyles.None, CultureInfo.InvariantCulture, out year) &&
            year is >= 1000 and <= 9999;
    }

    private static ReleaseFolderScanTrack CreateTrack(
        string releaseRoot,
        DesktopScanFile file,
        DraftParsers parsers)
    {
        ParsedTrackFile parsed = TrackFileNameParser.Parse(Path.GetFileName(file.RelativePath), parsers.TrackTemplates);
        DesktopAudioMetadataRequest? tags = file.Request.AudioMetadata;
        IReadOnlyList<string> artistNames = CleanNames(tags?.Artists);
        string? contentHash = NormalizeContentHash(file.Request.ContentHash);
        IReadOnlyList<ImportReviewIssue> issues = contentHash is null
            ? [
                .. parsed.Issues,
                new ImportReviewIssue(
                    ImportIssueCodes.ContentHashMissing,
                    "Desktop audio file is missing a SHA-256 content hash; duplicate detection will fall back to path, size, and last modified time")
            ]
            : parsed.Issues;

        string trackRelativePath = Path.GetRelativePath(releaseRoot, file.FilePath);
        TrackPositionContext positionContext = TrackPositionContextFromRelativePath(trackRelativePath, parsers.DiscFolders);

        return new ReleaseFolderScanTrack(
            file.FilePath,
            trackRelativePath,
            file.AudioFormat ?? throw new InvalidOperationException("Track file requires an audio format"),
            file.Request.SizeBytes,
            file.Request.LastModifiedAt,
            contentHash,
            FileCodec(file.AudioFormat.Value, tags),
            FileQuality(file.AudioFormat.Value, tags),
            tags?.DurationSeconds is null ? null : TimeSpan.FromSeconds(tags.DurationSeconds.Value),
            tags?.BitrateKbps,
            tags?.SampleRateHz,
            tags?.Channels,
            tags?.TrackNumber ?? parsed.Position,
            positionContext.Disc,
            positionContext.Side,
            TrimOrNull(tags?.Title) ?? parsed.Title ?? Path.GetFileNameWithoutExtension(file.RelativePath),
            artistNames.Count > 0 ? artistNames : parsed.ArtistNames,
            issues);
    }

    private static string? FileCodec(AudioFileFormat format, DesktopAudioMetadataRequest? metadata)
    {
        return TrimOrNull(metadata?.Codec) ??
            (format == AudioFileFormat.Alac ? "ALAC" : null);
    }

    private static AudioFileQuality? FileQuality(AudioFileFormat format, DesktopAudioMetadataRequest? metadata)
    {
        return metadata?.Lossless switch
        {
            true => AudioFileQuality.Lossless,
            false => AudioFileQuality.Lossy,
            null => InferredFileQuality(format)
        };
    }

    private static AudioFileQuality? InferredFileQuality(AudioFileFormat format)
    {
        return format switch
        {
            AudioFileFormat.Flac or AudioFileFormat.Wav or AudioFileFormat.Aiff or AudioFileFormat.Alac => AudioFileQuality.Lossless,
            AudioFileFormat.Mp3 or AudioFileFormat.Ogg => AudioFileQuality.Lossy,
            AudioFileFormat.M4a => null,
            _ => null
        };
    }

    private static TrackPositionContext TrackPositionContextFromRelativePath(string relativePath, DiscFolderNameParser discFolders)
    {
        string[] segments =
        [
            .. NormalizeRelativePath(DirectoryRelativePath(relativePath))
                .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        ];
        string? disc = segments
            .Select(discFolders.Parse)
            .LastOrDefault(parsedDisc => parsedDisc is not null)?.Marker;
        string? side = segments
            .Select(SideFromDirectory)
            .LastOrDefault(value => value is not null);

        return new TrackPositionContext(disc, side);
    }

    private static DesktopAudioMetadataRequest FirstReleaseTags(IReadOnlyList<DesktopScanFile> audioFiles)
    {
        return audioFiles
            .Select(file => file.Request.AudioMetadata)
            .FirstOrDefault(metadata => metadata is not null &&
                (!string.IsNullOrWhiteSpace(metadata.AlbumTitle) ||
                    CleanNames(metadata.AlbumArtists).Count > 0 ||
                    !string.IsNullOrWhiteSpace(metadata.ReleaseDate) ||
                    metadata.Year is not null ||
                    !string.IsNullOrWhiteSpace(metadata.CatalogNumber))) ??
            new DesktopAudioMetadataRequest(null, [], null, [], null, null, null, null, null, null, null, null, null, null, null);
    }

    private static string? ReleaseAlbumTitle(IReadOnlyList<DesktopScanFile> audioFiles, DesktopAudioMetadataRequest releaseTags)
    {
        string? firstTitle = TrimOrNull(releaseTags.AlbumTitle);
        if (firstTitle is null)
        {
            return null;
        }

        string[] albumTitles = DistinctAlbumTitles(audioFiles.Select(file => file.Request.AudioMetadata?.AlbumTitle));
        string[] baseTitles = DistinctAlbumTitles(albumTitles.Select(ImportAlbumTitles.WithoutDiscSuffix));

        // Multi-disc releases are often tagged "Album Cd1", "Album Cd2"; keep the shared album title.
        return albumTitles.Length > 1 && baseTitles.Length == 1 ? baseTitles[0] : firstTitle;
    }

    private static string[] DistinctAlbumTitles(IEnumerable<string?> titles)
    {
        return
        [
            .. titles
                .Select(TrimOrNull)
                .OfType<string>()
                .Distinct(StringComparer.OrdinalIgnoreCase)
        ];
    }

    private sealed record TrackPositionContext(string? Disc, string? Side);

    private sealed record DraftParsers(
        IReadOnlyList<string> ReleaseTemplates,
        IReadOnlyList<string> TrackTemplates,
        DiscFolderNameParser DiscFolders);
}
