using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Api.Features.ReviewWorkbench;

public static partial class ReviewWorkbenchSignalBuilder
{
    private static IEnumerable<ReviewWorkbenchSignal> DuplicateLocalAudioFileSignals(
        CollectionId collectionId,
        IReadOnlyList<LocalAudioFile> localAudioFiles)
    {
        return localAudioFiles
            .Select(file => new
            {
                File = file,
                ContentHash = OptionalString(file.ContentHash)
            })
            .Where(item => !string.IsNullOrWhiteSpace(item.ContentHash))
            .GroupBy(item => item.ContentHash!, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1)
            .Select(group =>
            {
                string contentHash = group.Key;
                ReviewWorkbenchSignalTarget[] targets =
                [
                    .. group
                        .Select(item => LocalAudioFileTarget(item.File))
                        .OrderBy(target => target.Title, StringComparer.OrdinalIgnoreCase)
                        .ThenBy(target => target.Id)
                ];

                return CreateSignal(
                    collectionId,
                    ReviewWorkbenchCategories.DuplicateCandidates,
                    ReviewWorkbenchSubtypes.DuplicateDigitalFileIdentities,
                    $"Duplicate local audio file identity: {ShortHash(contentHash)}",
                    targets,
                    contentHash);
            });
    }

    private static IEnumerable<ReviewWorkbenchSignal> DigitalFileCoverageSignals(
        CollectionId collectionId,
        IReadOnlyList<OwnedItemProjection> ownedItems,
        IReadOnlyList<ReleaseTrack> releaseTracks,
        IReadOnlyList<LocalAudioFile> localAudioFiles,
        IReadOnlyList<DigitalTrackFileLink> digitalTrackFileLinks,
        IReadOnlyDictionary<Guid, string> releaseTitles,
        IReadOnlyDictionary<Guid, string> trackTitles)
    {
        var releaseTracksByReleaseId = releaseTracks
            .GroupBy(track => track.ReleaseId)
            .ToDictionary(group => group.Key, group => group.OrderBy(track => track.Position.Number).ToArray());
        var linkedReleaseTrackIdsByOwnedItemId = digitalTrackFileLinks
            .GroupBy(link => link.DigitalOwnedItemId)
            .ToDictionary(group => group.Key, group => group.Select(link => link.ReleaseTrackId).ToHashSet());

        foreach (OwnedItemProjection item in ownedItems.Where(item => item.IsDigital))
        {
            ReleaseTrack[] itemReleaseTracks = releaseTracksByReleaseId.GetValueOrDefault(item.ReleaseId) ?? [];
            if (itemReleaseTracks.Length == 0)
            {
                continue;
            }

            HashSet<ReleaseTrackId> linkedReleaseTrackIds = linkedReleaseTrackIdsByOwnedItemId.GetValueOrDefault(item.Id) ?? [];
            ReleaseTrack[] missingTracks = [.. itemReleaseTracks.Where(track => !linkedReleaseTrackIds.Contains(track.Id))];
            if (missingTracks.Length == 0)
            {
                continue;
            }

            string releaseTitle = OwnedItemTitle(item, releaseTitles, trackTitles);
            string comparisonKey = string.Join("|", missingTracks.Select(track => track.Id.Value.ToString("D")).Order(StringComparer.Ordinal));
            yield return CreateSignal(
                collectionId,
                ReviewWorkbenchCategories.MissingMetadata,
                ReviewWorkbenchSubtypes.DigitalCopiesMissingLinkedFiles,
                $"Digital copy missing linked files: {releaseTitle}",
                [OwnedItemTarget(item, releaseTitles, trackTitles)],
                comparisonKey);
        }

        HashSet<LocalAudioFileId> linkedLocalAudioFileIds = [.. digitalTrackFileLinks.Select(link => link.LocalAudioFileId)];
        foreach (LocalAudioFile file in localAudioFiles.Where(file => file.Format is not { HasValue: true }))
        {
            yield return SingleTargetSignal(
                collectionId,
                ReviewWorkbenchCategories.MissingMetadata,
                ReviewWorkbenchSubtypes.LocalAudioFilesMissingFormat,
                $"Local audio file missing format: {file.Path.Value}",
                LocalAudioFileTarget(file));
        }

        foreach (LocalAudioFile file in localAudioFiles.Where(file => file.Codec is not { HasValue: true }))
        {
            yield return SingleTargetSignal(
                collectionId,
                ReviewWorkbenchCategories.MissingMetadata,
                ReviewWorkbenchSubtypes.LocalAudioFilesMissingCodec,
                $"Local audio file missing codec: {file.Path.Value}",
                LocalAudioFileTarget(file));
        }

        foreach (LocalAudioFile file in localAudioFiles.Where(file => !linkedLocalAudioFileIds.Contains(file.Id)))
        {
            yield return SingleTargetSignal(
                collectionId,
                ReviewWorkbenchCategories.ImportCleanup,
                ReviewWorkbenchSubtypes.LocalAudioFilesUnmapped,
                $"Local audio file is not mapped to a release track: {file.Path.Value}",
                LocalAudioFileTarget(file));
        }
    }

    private static IEnumerable<ReviewWorkbenchSignal> LossyWithoutLosslessSignals(
        CollectionId collectionId,
        IReadOnlyList<ReleaseTrack> releaseTracks,
        IReadOnlyList<LocalAudioFile> localAudioFiles,
        IReadOnlyList<DigitalTrackFileLink> digitalTrackFileLinks,
        IReadOnlyDictionary<Guid, string> releaseTitles,
        IReadOnlyDictionary<Guid, string> trackTitles)
    {
        var releaseTracksById = releaseTracks.ToDictionary(track => track.Id);
        var localAudioFilesById = localAudioFiles.ToDictionary(file => file.Id);

        foreach (IGrouping<ReleaseTrackId, DigitalTrackFileLink> group in digitalTrackFileLinks.GroupBy(link => link.ReleaseTrackId))
        {
            LocalAudioFile[] files =
            [
                .. group
                    .Select(link => localAudioFilesById.TryGetValue(link.LocalAudioFileId, out LocalAudioFile? file) ? file : null)
                    .Where(file => file is not null)
                    .Select(file => file!)
            ];
            if (files.Length == 0 ||
                !files.Any(file => ResolvedQuality(file) == AudioFileQuality.Lossy) ||
                files.Any(file => ResolvedQuality(file) == AudioFileQuality.Lossless) ||
                !releaseTracksById.TryGetValue(group.Key, out ReleaseTrack? releaseTrack))
            {
                continue;
            }

            string trackTitle = ResolveTargetTitle(ReviewWorkbenchTargetKinds.Track, releaseTrack.TrackId.Value, releaseTitles, trackTitles);
            string releaseTitle = ResolveTargetTitle(ReviewWorkbenchTargetKinds.Release, releaseTrack.ReleaseId.Value, releaseTitles, trackTitles);
            yield return CreateSignal(
                collectionId,
                ReviewWorkbenchCategories.FormatGaps,
                ReviewWorkbenchSubtypes.LossyWithoutLossless,
                $"Lossy file without lossless copy: {trackTitle}",
                [
                    Target(ReviewWorkbenchTargetKinds.Track, releaseTrack.TrackId.Value, trackTitle, releaseTitle),
                    Target(ReviewWorkbenchTargetKinds.Release, releaseTrack.ReleaseId.Value, releaseTitle)
                ],
                releaseTrack.Id.Value.ToString("D"));
        }
    }

    private static ReviewWorkbenchSignalTarget LocalAudioFileTarget(LocalAudioFile file)
    {
        return Target(ReviewWorkbenchTargetKinds.LocalAudioFile, file.Id.Value, file.Path.Value, LocalAudioFileSubtitle(file));
    }

    private static string? LocalAudioFileSubtitle(LocalAudioFile file)
    {
        string? format = OptionalAudioFormat(file.Format);
        string? codec = OptionalString(file.Codec);

        return (format, codec) switch
        {
            ({ Length: > 0 }, { Length: > 0 }) => $"{format} / {codec}",
            ({ Length: > 0 }, _) => format,
            (_, { Length: > 0 }) => codec,
            _ => null
        };
    }

    private static string? OptionalString(IOptionalValue<string>? value)
    {
        return value is { HasValue: true } ? value.Match(present => present, () => string.Empty) : null;
    }

    private static string? OptionalAudioFormat(IOptionalValue<AudioFileFormat>? value)
    {
        return value is { HasValue: true } ? value.Match(ToAudioFileFormatCode, () => string.Empty) : null;
    }

    private static string ToAudioFileFormatCode(AudioFileFormat format)
    {
        return format switch
        {
            AudioFileFormat.Flac => "flac",
            AudioFileFormat.Mp3 => "mp3",
            AudioFileFormat.Ogg => "ogg",
            AudioFileFormat.Wav => "wav",
            AudioFileFormat.Aiff => "aiff",
            AudioFileFormat.Alac => "alac",
            AudioFileFormat.M4a => "m4a",
            _ => throw new InvalidOperationException("Audio file format is not supported")
        };
    }

    private static AudioFileQuality? ResolvedQuality(LocalAudioFile file)
    {
        return file.Quality is PresentOptionalValue<AudioFileQuality> quality
            ? quality.Value
            : InferredQuality(file);
    }

    private static AudioFileQuality? InferredQuality(LocalAudioFile file)
    {
        return file.Format is PresentOptionalValue<AudioFileFormat> format
            ? InferredQuality(format.Value)
            : null;
    }

    private static AudioFileQuality? InferredQuality(AudioFileFormat format)
    {
        return format switch
        {
            AudioFileFormat.Flac or AudioFileFormat.Wav or AudioFileFormat.Aiff or AudioFileFormat.Alac => AudioFileQuality.Lossless,
            AudioFileFormat.Mp3 or AudioFileFormat.Ogg or AudioFileFormat.M4a => AudioFileQuality.Lossy,
            _ => null
        };
    }

    private static string ShortHash(string contentHash)
    {
        string trimmed = contentHash.Trim();
        return trimmed.Length <= 12 ? trimmed : trimmed[..12];
    }
}
