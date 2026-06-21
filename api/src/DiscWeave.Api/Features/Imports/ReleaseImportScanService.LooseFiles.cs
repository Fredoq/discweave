using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Importing;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportScanService
{
    private const string RootAudioLooseReason = "root_audio_unclear_release_context";
    private const string MixedAlbumTagsLooseReason = "mixed_album_tags";

    private static LooseFileClassification ClassifyLooseFiles(
        IReadOnlyList<DesktopScanFile> audioFiles,
        Dictionary<string, DirectoryFacts> directoryFacts)
    {
        List<DesktopScanFile> draftFiles = [];
        List<ReleaseFolderLooseFileCandidate> candidates = [];
        HashSet<string> seenCandidatePaths = new(StringComparer.OrdinalIgnoreCase);

        foreach (IGrouping<string, DesktopScanFile> group in audioFiles.GroupBy(file => ReleaseRootFor(file.RelativePath, directoryFacts), StringComparer.OrdinalIgnoreCase))
        {
            DesktopScanFile[] groupFiles = [.. group.OrderBy(file => file.RelativePath, StringComparer.OrdinalIgnoreCase)];
            string? looseReason = LooseReason(group.Key, groupFiles);
            if (looseReason is null)
            {
                draftFiles.AddRange(groupFiles);
                continue;
            }

            foreach (DesktopScanFile file in groupFiles)
            {
                if (seenCandidatePaths.Add(file.RelativePath))
                {
                    candidates.Add(ToLooseFileCandidate(file, looseReason));
                }
            }
        }

        return new LooseFileClassification(draftFiles, candidates);
    }

    private static string? LooseReason(string releaseRootRelativePath, IReadOnlyList<DesktopScanFile> files)
    {
        if (string.IsNullOrWhiteSpace(releaseRootRelativePath))
        {
            return RootAudioLooseReason;
        }

        string[] albumTitles =
        [
            .. files
                .Select(file => TrimOrNull(file.Request.AudioMetadata?.AlbumTitle))
                .Where(title => title is not null)
                .Select(title => title!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
        ];

        return albumTitles.Length > 1 ? MixedAlbumTagsLooseReason : null;
    }

    private static ReleaseFolderLooseFileCandidate ToLooseFileCandidate(DesktopScanFile file, string reason)
    {
        DesktopAudioMetadataRequest? metadata = file.Request.AudioMetadata;
        AudioFileFormat format = file.AudioFormat ?? throw new InvalidOperationException("Loose audio file requires an audio format");
        return new ReleaseFolderLooseFileCandidate(
            file.FilePath,
            file.RelativePath,
            format,
            file.Request.SizeBytes,
            file.Request.LastModifiedAt,
            NormalizeContentHash(file.Request.ContentHash),
            metadata?.DurationSeconds,
            FileCodec(format, metadata),
            FileQuality(format, metadata),
            metadata?.BitrateKbps,
            metadata?.SampleRateHz,
            metadata?.Channels,
            TrimOrNull(metadata?.Title),
            CleanNames(metadata?.Artists),
            TrimOrNull(metadata?.AlbumTitle),
            CleanNames(metadata?.AlbumArtists),
            metadata?.TrackNumber,
            reason);
    }

    private static ReleaseImportLooseFileCandidate ToLooseFileCandidate(
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseFolderLooseFileCandidate candidate,
        DateTimeOffset createdAt)
    {
        return ReleaseImportLooseFileCandidate.Create(
            collectionId,
            sessionId,
            ReleaseImportLooseFileCandidateId.New(),
            new LooseFileCandidateFields(
                candidate.FilePath,
                candidate.RelativePath,
                candidate.Format,
                candidate.SizeBytes,
                candidate.LastModifiedAt,
                candidate.ContentHash,
                candidate.DurationSeconds,
                candidate.Codec,
                candidate.Quality,
                candidate.BitrateKbps,
                candidate.SampleRateHz,
                candidate.Channels,
                candidate.TitleHint,
                candidate.ArtistHints,
                candidate.AlbumTitleHint,
                candidate.AlbumArtistHints,
                candidate.TrackNumber,
                candidate.Reason),
            createdAt);
    }

    private sealed record LooseFileClassification(
        IReadOnlyList<DesktopScanFile> DraftFiles,
        IReadOnlyList<ReleaseFolderLooseFileCandidate> Candidates);
}
