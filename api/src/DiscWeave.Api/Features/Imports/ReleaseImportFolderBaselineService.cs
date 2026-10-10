using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

// The baseline is what a watched folder is compared against on disk: catalog files of every release
// stored under the folder, draft files for drafts still in review, and every other known path.
internal static class ReleaseImportFolderBaselineService
{
    public static async Task<ReleaseImportFolderBaselineResponse?> LoadAsync(
        ReleaseImportSession session,
        DiscWeaveDbContext context,
        CancellationToken cancellationToken)
    {
        // An archived import is out of review, so a watched folder must move on to a fresh session.
        if (session.SourceKind != ReleaseImportSourceKind.LocalFiles ||
            session.ArchivedAt is not null ||
            session.SourceRoot is not PresentOptionalValue<string> sourceRoot)
        {
            return null;
        }

        CollectionId collectionId = session.CollectionId;
        ReleaseImportDraft[] drafts = await context.ReleaseImportDrafts.AsNoTracking()
            .Where(draft => draft.CollectionId == collectionId && draft.SessionId == session.Id)
            .OrderBy(draft => EF.Property<long>(draft, "id"))
            .ToArrayAsync(cancellationToken);
        ReleaseImportDraftId[] draftIds = [.. drafts.Select(draft => draft.Id)];
        ILookup<ReleaseImportDraftId, ReleaseImportFolderBaselineFileResponse> draftFiles =
            (await context.ReleaseImportDraftTracks.AsNoTracking()
                .Where(track => track.CollectionId == collectionId && draftIds.Contains(track.DraftId))
                .ToArrayAsync(cancellationToken))
            .Where(track => track.LocalFile is PresentOptionalValue<ReleaseImportLocalFileDescriptor>)
            .ToLookup(track => track.DraftId, track => DraftFile(((PresentOptionalValue<ReleaseImportLocalFileDescriptor>)track.LocalFile).Value));

        List<ReleaseImportFolderBaselineDraftResponse> entries = [];
        HashSet<string> otherKnownPaths = new(StringComparer.Ordinal);
        foreach (ReleaseImportDraft draft in drafts)
        {
            AddDraftFiles(draft, [.. draftFiles[draft.Id]], entries, otherKnownPaths);
        }

        otherKnownPaths.UnionWith(await context.ReleaseImportLooseFileCandidates.AsNoTracking()
            .Where(candidate => candidate.CollectionId == collectionId && candidate.SessionId == session.Id)
            .Select(candidate => candidate.FilePath)
            .ToArrayAsync(cancellationToken));
        await AddCatalogFilesAsync(context, collectionId, sourceRoot.Value, entries, otherKnownPaths, cancellationToken);
        otherKnownPaths.ExceptWith(entries.SelectMany(entry => entry.Files).Select(file => file.Path));
        return new ReleaseImportFolderBaselineResponse(
            sourceRoot.Value,
            entries,
            [.. otherKnownPaths.Order(StringComparer.Ordinal)]);
    }

    private static void AddDraftFiles(
        ReleaseImportDraft draft,
        ReleaseImportFolderBaselineFileResponse[] files,
        List<ReleaseImportFolderBaselineDraftResponse> entries,
        HashSet<string> otherKnownPaths)
    {
        if (draft.Status is ReleaseImportDraftStatus.Ready or ReleaseImportDraftStatus.NeedsReview)
        {
            entries.Add(new ReleaseImportFolderBaselineDraftResponse(
                draft.Id.Value,
                draft.Status == ReleaseImportDraftStatus.Ready ? "ready" : "needsReview",
                draft.SourcePath is PresentOptionalValue<string> path ? path.Value : null,
                null,
                draft.Title,
                files));
            return;
        }

        // Skipped drafts and tracks left out of a confirmed release stay known so they do not
        // resurface as new files.
        otherKnownPaths.UnionWith(files.Select(file => file.Path));
    }

    // Every catalog release with local files under the folder is compared with disk, whichever import
    // created it; catalog files that are not linked to a release are only known paths.
    private static async Task AddCatalogFilesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        string sourceRoot,
        List<ReleaseImportFolderBaselineDraftResponse> entries,
        HashSet<string> otherKnownPaths,
        CancellationToken cancellationToken)
    {
        string prefix = Path.TrimEndingDirectorySeparator(sourceRoot) + Path.DirectorySeparatorChar;
        // ponytail: loads every collection file and filters by folder in memory; move the prefix filter into SQL if collections outgrow it.
        LocalAudioFile[] folderFiles =
        [
            .. (await context.LocalAudioFiles.AsNoTracking()
                .Where(file => file.CollectionId == collectionId)
                .ToArrayAsync(cancellationToken))
            .Where(file => file.Path.Value.StartsWith(prefix, StringComparison.Ordinal))
        ];
        otherKnownPaths.UnionWith(folderFiles.Select(file => file.Path.Value));
        if (folderFiles.Length == 0)
        {
            return;
        }

        LocalAudioFileId[] fileIds = [.. folderFiles.Select(file => file.Id)];
        DigitalTrackFileLink[] links = await context.DigitalTrackFileLinks.AsNoTracking()
            .Where(link => link.CollectionId == collectionId && fileIds.Contains(link.LocalAudioFileId))
            .ToArrayAsync(cancellationToken);
        ReleaseTrackId[] releaseTrackIds = [.. links.Select(link => link.ReleaseTrackId).Distinct()];
        Dictionary<ReleaseTrackId, ReleaseId> releaseIdByTrackId = await context.ReleaseTracks.AsNoTracking()
            .Where(track => track.CollectionId == collectionId && releaseTrackIds.Contains(track.Id))
            .ToDictionaryAsync(track => track.Id, track => track.ReleaseId, cancellationToken);
        ReleaseId[] releaseIds = [.. releaseIdByTrackId.Values.Distinct()];
        Dictionary<ReleaseId, string> titlesByReleaseId = (await context.Releases.AsNoTracking()
                .Where(release => release.CollectionId == collectionId && releaseIds.Contains(release.Id))
                .ToArrayAsync(cancellationToken))
            .ToDictionary(release => release.Id, release => release.DisplayName);
        Dictionary<LocalAudioFileId, LocalAudioFile> filesById = folderFiles.ToDictionary(file => file.Id);

        entries.AddRange(links
            .Where(link => releaseIdByTrackId.ContainsKey(link.ReleaseTrackId))
            .GroupBy(link => releaseIdByTrackId[link.ReleaseTrackId])
            .Where(group => titlesByReleaseId.ContainsKey(group.Key))
            .OrderBy(group => titlesByReleaseId[group.Key], StringComparer.OrdinalIgnoreCase)
            .ThenBy(group => group.Key.Value)
            .Select(group => new ReleaseImportFolderBaselineDraftResponse(
                null,
                "confirmed",
                null,
                group.Key.Value,
                titlesByReleaseId[group.Key],
                [
                    .. group
                        .Select(link => filesById[link.LocalAudioFileId])
                        .DistinctBy(file => file.Id)
                        .OrderBy(file => file.Path.Value, StringComparer.Ordinal)
                        .Select(CatalogFile)
                ])));
    }

    private static ReleaseImportFolderBaselineFileResponse DraftFile(ReleaseImportLocalFileDescriptor file)
    {
        return new ReleaseImportFolderBaselineFileResponse(file.FilePath, file.SizeBytes, file.LastModifiedAt, null);
    }

    private static ReleaseImportFolderBaselineFileResponse CatalogFile(LocalAudioFile file)
    {
        return new ReleaseImportFolderBaselineFileResponse(
            file.Path.Value,
            file.SizeBytes is PresentOptionalValue<long> sizeBytes ? sizeBytes.Value : null,
            file.ModifiedAt is PresentOptionalValue<DateTimeOffset> modifiedAt ? modifiedAt.Value : null,
            file.Id.Value);
    }
}
