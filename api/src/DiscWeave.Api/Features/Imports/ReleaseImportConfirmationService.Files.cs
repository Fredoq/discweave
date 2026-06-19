using DiscWeave.Application.Catalog.Releases;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
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

    private static Task AddTrackFileOwnedItemsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Release release,
        IReadOnlyList<ReleaseImportDraftTrack> draftTracks,
        CancellationToken cancellationToken)
    {
        _ = context;
        _ = collectionId;
        _ = release;
        _ = draftTracks;
        _ = cancellationToken;

        return Task.CompletedTask;
    }

    private static async Task AddReleaseOwnedItemAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Release release,
        ReleaseImportDraft draft,
        IReadOnlyList<ReleaseImportDraftTrack> draftTracks,
        CancellationToken cancellationToken)
    {
        _ = draft;
        _ = draftTracks;

        bool exists = await context.OwnedItems.AnyAsync(
            item =>
                item.CollectionId == collectionId &&
                EF.Property<ReleaseId>(item, "_releaseId") == release.Id &&
                EF.Property<string>(item, "_mediumType") == DigitalMediumType,
            cancellationToken);
        if (exists)
        {
            return;
        }

        var item = OwnedItem.Create(
            collectionId,
            OwnedItemId.New(),
            release.Id,
            OwnershipStatus.Owned,
            DigitalFile.Create());
        _ = context.OwnedItems.Add(item);
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
