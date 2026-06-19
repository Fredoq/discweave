using DiscWeave.Application.Catalog.Releases;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Importing;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ReleaseImportConfirmationService
{
    private const string DigitalMediumType = "digital";

    private async Task<ReleaseMetadata> ApplyCoverAsync(
        ReleaseMetadata metadata,
        ReleaseId releaseId,
        CollectionId collectionId,
        ReleaseImportDraft draft,
        CancellationToken cancellationToken)
    {
        if (draft.CoverContent is { Length: > 0 } coverContent &&
            !string.IsNullOrWhiteSpace(draft.CoverExtension) &&
            ReleaseImportFileRules.IsSupportedCover(draft.CoverExtension))
        {
            await using var artifactStream = new MemoryStream(coverContent);
            ReleaseCoverStoredFile storedArtifact = await _coverStorage.SaveAsync(
                collectionId,
                releaseId,
                draft.CoverExtension,
                artifactStream,
                cancellationToken);

            return metadata.WithCoverImage(CoverImage.FromLocalUpload(
                storedArtifact.StorageKey,
                draft.CoverContentType ?? ReleaseImportFileRules.CoverContentType(draft.CoverExtension),
                draft.CoverFileName ?? $"cover{draft.CoverExtension}",
                draft.CoverSizeBytes ?? coverContent.Length));
        }

        if (string.IsNullOrWhiteSpace(draft.CoverPath) || !File.Exists(draft.CoverPath) || !ReleaseImportFileRules.IsSupportedCover(draft.CoverPath))
        {
            return metadata;
        }

        await using FileStream stream = File.OpenRead(draft.CoverPath);
        ReleaseCoverStoredFile stored = await _coverStorage.SaveAsync(
            collectionId,
            releaseId,
            Path.GetExtension(draft.CoverPath),
            stream,
            cancellationToken);
        FileInfo file = new(draft.CoverPath);

        return metadata.WithCoverImage(CoverImage.FromLocalUpload(
            stored.StorageKey,
            ContentType(file.Extension),
            file.Name,
            file.Length));
    }

    private static async Task AddReleaseFileLinksAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Release release,
        IReadOnlyList<ReleaseImportDraftTrack> draftTracks,
        Dictionary<ReleaseImportDraftTrackId, TrackId> resolvedTrackIdsByDraftTrackId,
        CancellationToken cancellationToken)
    {
        OwnedItem digitalOwnedItem = await GetOrCreateDigitalOwnedItemAsync(
            context,
            collectionId,
            release,
            cancellationToken);
        var releaseTracksByTrackId = release.Tracklist
            .GroupBy(track => track.TrackId)
            .ToDictionary(group => group.Key, group => group.OrderBy(track => track.Position.Number).ToArray());

        foreach (ReleaseImportDraftTrack draftTrack in draftTracks.Where(track => !track.IsSkipped))
        {
            if (!resolvedTrackIdsByDraftTrackId.TryGetValue(draftTrack.Id, out TrackId trackId))
            {
                throw new DomainException("release_import.release_track_not_resolved", "Release import track was not resolved");
            }

            ReleaseTrack releaseTrack = ResolveReleaseTrackForDraftTrack(releaseTracksByTrackId, trackId, draftTrack);
            LocalAudioFile localFile = await GetOrCreateLocalAudioFileAsync(context, collectionId, draftTrack, cancellationToken);
            await UpsertDigitalTrackFileLinkAsync(
                context,
                collectionId,
                digitalOwnedItem.Id,
                releaseTrack.Id,
                localFile.Id,
                cancellationToken);
        }
    }

    private static async Task<OwnedItem> GetOrCreateDigitalOwnedItemAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Release release,
        CancellationToken cancellationToken)
    {
        OwnedItem? existing = await context.OwnedItems.SingleOrDefaultAsync(
            item =>
                item.CollectionId == collectionId &&
                EF.Property<ReleaseId>(item, "_releaseId") == release.Id &&
                EF.Property<string>(item, "_mediumType") == DigitalMediumType,
            cancellationToken);
        if (existing is not null)
        {
            return existing;
        }

        var item = OwnedItem.Create(
            collectionId,
            OwnedItemId.New(),
            release.Id,
            OwnershipStatus.Owned,
            DigitalFile.Create());
        _ = context.OwnedItems.Add(item);

        return item;
    }

    private static ReleaseTrack ResolveReleaseTrackForDraftTrack(
        Dictionary<TrackId, ReleaseTrack[]> releaseTracksByTrackId,
        TrackId trackId,
        ReleaseImportDraftTrack draftTrack)
    {
        if (!releaseTracksByTrackId.TryGetValue(trackId, out ReleaseTrack[]? candidates) || candidates.Length == 0)
        {
            throw new DomainException("release_import.release_track_not_resolved", "Release import track was not resolved");
        }

        if (draftTrack.Position is { } position)
        {
            ReleaseTrack[] positionMatches = [.. candidates.Where(track => track.Position.Number == position)];
            if (positionMatches.Length == 1)
            {
                return positionMatches[0];
            }
        }

        return candidates.Length == 1
            ? candidates[0]
            : throw new DomainException("release_import.release_track_ambiguous", "Release import track mapping is ambiguous");
    }

    private static async Task<LocalAudioFile> GetOrCreateLocalAudioFileAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportDraftTrack draftTrack,
        CancellationToken cancellationToken)
    {
        var path = FilePath.FromAbsolutePath(draftTrack.FilePath);
        LocalAudioFile[] existingFiles = await context.LocalAudioFiles
            .Where(file => file.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);
        LocalAudioFile? existing = existingFiles.SingleOrDefault(file => file.Path == path);
        if (existing is not null)
        {
            return ApplyDraftFileMetadata(existing, draftTrack);
        }

        LocalAudioFile created = ApplyDraftFileMetadata(
            LocalAudioFile.Create(collectionId, LocalAudioFileId.New(), path),
            draftTrack);
        _ = context.LocalAudioFiles.Add(created);

        return created;
    }

    private static LocalAudioFile ApplyDraftFileMetadata(LocalAudioFile file, ReleaseImportDraftTrack draftTrack)
    {
        _ = file
            .WithFormat(draftTrack.Format)
            .WithSizeBytes(draftTrack.SizeBytes)
            .WithModifiedAt(draftTrack.LastModifiedAt);

        var path = FilePath.FromAbsolutePath(draftTrack.FilePath);
        FileImportIdentity identity = draftTrack.ContentHash is PresentOptionalValue<string> contentHash
            ? FileImportIdentity.Create(
                path,
                draftTrack.SizeBytes,
                draftTrack.LastModifiedAt,
                contentHash.Value)
            : FileImportIdentity.Create(
                path,
                draftTrack.SizeBytes,
                draftTrack.LastModifiedAt);
        if (draftTrack.ContentHash is PresentOptionalValue<string> presentContentHash)
        {
            _ = file.WithContentHash(presentContentHash.Value);
        }

        _ = file.WithImportIdentity(identity);

        return file;
    }

    private static async Task UpsertDigitalTrackFileLinkAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        OwnedItemId digitalOwnedItemId,
        ReleaseTrackId releaseTrackId,
        LocalAudioFileId localAudioFileId,
        CancellationToken cancellationToken)
    {
        DigitalTrackFileLink? existing = await context.DigitalTrackFileLinks.SingleOrDefaultAsync(
            link =>
                link.CollectionId == collectionId &&
                link.DigitalOwnedItemId == digitalOwnedItemId &&
                link.ReleaseTrackId == releaseTrackId,
            cancellationToken);
        if (existing is not null)
        {
            if (existing.LocalAudioFileId != localAudioFileId)
            {
                _ = existing.Relink(localAudioFileId);
            }

            return;
        }

        _ = context.DigitalTrackFileLinks.Add(DigitalTrackFileLink.Create(
            collectionId,
            DigitalTrackFileLinkId.New(),
            digitalOwnedItemId,
            releaseTrackId,
            localAudioFileId));
    }

    private static string ContentType(string extension)
    {
        return extension.ToLowerInvariant() switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };
    }

}
