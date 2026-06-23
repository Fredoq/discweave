using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

internal sealed class FileMoveHintLookup
{
    private static readonly StringComparer PathComparer = StringComparer.Ordinal;
    private readonly IReadOnlyDictionary<string, ReleaseImportFileMoveHintResponse> _hintsByPath;

    private FileMoveHintLookup(IReadOnlyDictionary<string, ReleaseImportFileMoveHintResponse> hintsByPath)
    {
        _hintsByPath = hintsByPath;
    }

    public static FileMoveHintLookup Empty { get; } = new(new Dictionary<string, ReleaseImportFileMoveHintResponse>(PathComparer));

    public static async Task<FileMoveHintLookup> LoadAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyList<ReleaseImportDraftTrack> tracks,
        IReadOnlyList<ReleaseImportLooseFileCandidate> looseFileCandidates,
        CancellationToken cancellationToken)
    {
        MoveHintSource[] sources =
        [
            .. tracks.Select(track => new MoveHintSource(
                track.FilePath,
                NormalizeContentHash(OptionalString(track.ContentHash)),
                track.SizeBytes,
                track.LastModifiedAt)),
            .. looseFileCandidates.Select(candidate => new MoveHintSource(
                candidate.FilePath,
                NormalizeContentHash(candidate.ContentHash),
                candidate.SizeBytes,
                candidate.LastModifiedAt))
        ];
        if (sources.Length == 0)
        {
            return Empty;
        }

        LocalFileMoveCandidate[] localFiles = await LoadLocalFileMoveCandidatesAsync(
            context,
            collectionId,
            sources,
            cancellationToken);
        if (localFiles.Length == 0)
        {
            return Empty;
        }

        var hintsByPath = new Dictionary<string, ReleaseImportFileMoveHintResponse>(PathComparer);
        foreach (MoveHintSource source in sources)
        {
            ReleaseImportFileMoveHintResponse? hint = HintFor(source, localFiles);
            if (hint is not null)
            {
                hintsByPath[source.FilePath] = hint;
            }
        }

        return new FileMoveHintLookup(hintsByPath);
    }

    public ReleaseImportFileMoveHintResponse? ForPath(string filePath)
    {
        return _hintsByPath.TryGetValue(filePath, out ReleaseImportFileMoveHintResponse? hint)
            ? hint
            : null;
    }

    private static async Task<LocalFileMoveCandidate[]> LoadLocalFileMoveCandidatesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyList<MoveHintSource> sources,
        CancellationToken cancellationToken)
    {
        var localFilesById = new Dictionary<LocalAudioFileId, LocalFileMoveCandidate>();
        string[] contentHashes =
        [
            .. sources
                .Select(source => source.ContentHash)
                .OfType<string>()
                .Distinct(StringComparer.Ordinal)
        ];
        if (contentHashes.Length > 0)
        {
            IOptionalValue<string>[] searchedHashes = [.. contentHashes.Select(Optional.From)];
            LocalAudioFile[] hashMatchedFiles = await context.LocalAudioFiles.AsNoTracking()
                .Where(file =>
                    file.CollectionId == collectionId &&
                    (searchedHashes.Contains(file.ContentHash) ||
                        contentHashes.Contains(EF.Property<string>(file, "_importIdentityContentHash"))))
                .ToArrayAsync(cancellationToken);
            AddLocalFileCandidates(localFilesById, hashMatchedFiles);
        }

        MoveHintSource[] fingerprintSources = [.. sources.Where(source => source.ContentHash is null)];
        if (fingerprintSources.Length > 0)
        {
            IOptionalValue<long>[] searchedSizes = [.. fingerprintSources.Select(source => source.SizeBytes).Distinct().Select(Optional.From)];
            IOptionalValue<DateTimeOffset>[] searchedModifiedAt =
            [
                .. fingerprintSources
                    .Select(source => source.LastModifiedAt)
                    .Distinct()
                    .Select(Optional.From)
            ];
            long?[] searchedImportIdentitySizes = [.. fingerprintSources.Select(source => (long?)source.SizeBytes).Distinct()];
            DateTimeOffset?[] searchedImportIdentityModifiedAt =
            [
                .. fingerprintSources
                    .Select(source => (DateTimeOffset?)source.LastModifiedAt)
                    .Distinct()
            ];

            LocalAudioFile[] fingerprintMatchedFiles = await context.LocalAudioFiles.AsNoTracking()
                .Where(file =>
                    file.CollectionId == collectionId &&
                    ((searchedSizes.Contains(file.SizeBytes) &&
                            searchedModifiedAt.Contains(file.ModifiedAt)) ||
                        (searchedImportIdentitySizes.Contains(EF.Property<long?>(file, "_importIdentitySizeBytes")) &&
                            searchedImportIdentityModifiedAt.Contains(EF.Property<DateTimeOffset?>(file, "_importIdentityLastModifiedAt")))))
                .ToArrayAsync(cancellationToken);
            AddLocalFileCandidates(localFilesById, fingerprintMatchedFiles);
        }

        return [.. localFilesById.Values];
    }

    private static void AddLocalFileCandidates(
        IDictionary<LocalAudioFileId, LocalFileMoveCandidate> localFilesById,
        IReadOnlyList<LocalAudioFile> files)
    {
        foreach (LocalAudioFile file in files)
        {
            localFilesById[file.Id] = ToLocalFileMoveCandidate(file);
        }
    }

    private static ReleaseImportFileMoveHintResponse? HintFor(
        MoveHintSource source,
        IReadOnlyList<LocalFileMoveCandidate> localFiles)
    {
        if (source.ContentHash is not null)
        {
            LocalFileMoveCandidate[] hashMatches =
            [
                .. localFiles.Where(file =>
                    file.MatchesContentHash(source.ContentHash) &&
                    !PathComparer.Equals(file.Path, source.FilePath))
            ];
            if (hashMatches.Length > 0)
            {
                return HintFromMatches(hashMatches, "contentHash", "high");
            }
        }

        if (source.ContentHash is null)
        {
            LocalFileMoveCandidate[] sizeMtimeMatches =
            [
                .. localFiles.Where(file =>
                    file.MatchesSizeMtime(source.SizeBytes, source.LastModifiedAt) &&
                    !PathComparer.Equals(file.Path, source.FilePath))
            ];
            if (sizeMtimeMatches.Length > 0)
            {
                return HintFromMatches(sizeMtimeMatches, "sizeMtime", "low");
            }
        }

        return null;
    }

    private static ReleaseImportFileMoveHintResponse HintFromMatches(
        IReadOnlyList<LocalFileMoveCandidate> matches,
        string matchKind,
        string unambiguousConfidence)
    {
        string[] previousPaths =
        [
            .. matches
                .Select(match => match.Path)
                .Distinct(PathComparer)
                .Order(StringComparer.Ordinal)
        ];

        return previousPaths.Length == 1
            ? new ReleaseImportFileMoveHintResponse(previousPaths[0], matchKind, unambiguousConfidence)
            : new ReleaseImportFileMoveHintResponse(null, matchKind, "ambiguous");
    }

    private static LocalFileMoveCandidate ToLocalFileMoveCandidate(LocalAudioFile file)
    {
        FileImportIdentity? importIdentity = OptionalImportIdentity(file.ImportIdentity);
        return new LocalFileMoveCandidate(
            file.Path.Value,
            NormalizeContentHash(OptionalString(file.ContentHash)),
            NormalizeContentHash(importIdentity?.ContentHash is { } contentHash
                ? OptionalString(contentHash)
                : null),
            OptionalLong(file.SizeBytes),
            OptionalDateTimeOffset(file.ModifiedAt),
            importIdentity?.SizeBytes,
            importIdentity?.LastModifiedAt);
    }

    private static string? NormalizeContentHash(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToLowerInvariant();
    }

    private static string? OptionalString(IOptionalValue<string> value)
    {
        return value is PresentOptionalValue<string> present ? present.Value : null;
    }

    private static long? OptionalLong(IOptionalValue<long> value)
    {
        return value is PresentOptionalValue<long> present ? present.Value : null;
    }

    private static DateTimeOffset? OptionalDateTimeOffset(IOptionalValue<DateTimeOffset> value)
    {
        return value is PresentOptionalValue<DateTimeOffset> present ? present.Value : null;
    }

    private static FileImportIdentity? OptionalImportIdentity(IOptionalValue<FileImportIdentity> value)
    {
        return value is PresentOptionalValue<FileImportIdentity> present ? present.Value : null;
    }

    private sealed record MoveHintSource(
        string FilePath,
        string? ContentHash,
        long SizeBytes,
        DateTimeOffset LastModifiedAt);

    private sealed record LocalFileMoveCandidate(
        string Path,
        string? ContentHash,
        string? ImportIdentityContentHash,
        long? SizeBytes,
        DateTimeOffset? ModifiedAt,
        long? ImportIdentitySizeBytes,
        DateTimeOffset? ImportIdentityModifiedAt)
    {
        public bool MatchesContentHash(string contentHash)
        {
            return ContentHash == contentHash || ImportIdentityContentHash == contentHash;
        }

        public bool MatchesSizeMtime(long sizeBytes, DateTimeOffset modifiedAt)
        {
            return (SizeBytes == sizeBytes && ModifiedAt == modifiedAt) ||
                (ImportIdentitySizeBytes == sizeBytes && ImportIdentityModifiedAt == modifiedAt);
        }
    }
}
