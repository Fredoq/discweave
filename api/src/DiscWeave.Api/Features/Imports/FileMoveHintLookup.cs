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

        LocalFileMoveCandidate[] localFiles =
        [
            .. (await context.LocalAudioFiles.AsNoTracking()
                .Where(file => file.CollectionId == collectionId)
                .ToArrayAsync(cancellationToken))
                .Select(ToLocalFileMoveCandidate)
        ];
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
