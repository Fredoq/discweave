using DiscWeave.Api.Features.Settings;
using DiscWeave.Application.Catalog.Releases;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ReleaseImportConfirmationService
{
    private const string MainArtistRole = "mainArtist";
    private readonly IReleaseCoverStorage _coverStorage;

    public ReleaseImportConfirmationService(IReleaseCoverStorage coverStorage)
    {
        _coverStorage = coverStorage;
    }

    public async Task<ReleaseImportSession?> ConfirmAsync(
        Guid sessionId,
        Guid draftId,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        await using IAsyncDisposable mutationLock = await AcquireDraftMutationLockAsync(collectionId, sessionId, draftId, cancellationToken);

        return await ConfirmCoreAsync(sessionId, draftId, context, collectionId, cancellationToken);
    }

    private async Task<ReleaseImportSession?> ConfirmCoreAsync(
        Guid sessionId,
        Guid draftId,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        await using Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction =
            await context.Database.BeginTransactionAsync(cancellationToken);
        ReleaseImportDraft? draft = await FindDraftForUpdateAsync(context, collectionId, sessionId, draftId, cancellationToken);
        ReleaseImportSession? session = await context.ReleaseImportSessions.SingleOrDefaultAsync(
            candidate => candidate.CollectionId == collectionId && candidate.Id == new ReleaseImportSessionId(sessionId),
            cancellationToken);
        if (session is null || draft is null)
        {
            return null;
        }

        if (draft.Status == ReleaseImportDraftStatus.Confirmed)
        {
            await transaction.CommitAsync(cancellationToken);
            return session;
        }

        if (draft.Status == ReleaseImportDraftStatus.Skipped)
        {
            throw new DomainException("release_import_draft.skipped", "Skipped release import drafts cannot be confirmed");
        }

        ReleaseImportDraftTrack[] tracks = await context.ReleaseImportDraftTracks
            .Where(track => track.CollectionId == collectionId && track.DraftId == draft.Id && !track.IsSkipped)
            .OrderBy(track => track.Position ?? 9999)
            .ThenBy(track => track.RelativePath)
            .ToArrayAsync(cancellationToken);
        if (tracks.Length == 0)
        {
            throw new DomainException("release_import.tracks_required", "Release import draft has no tracks to confirm");
        }

        Dictionary<ReleaseImportDraftTrackId, TrackId> resolvedTrackIdsByDraftTrackId = CreateSelectedTrackMap(tracks);
        Release? existingRelease = await FindExistingReleaseForSelectedTracksAsync(context, collectionId, draft, tracks, cancellationToken);
        if (existingRelease is not null)
        {
            await AddReleaseFileLinksAsync(
                context,
                collectionId,
                existingRelease,
                tracks,
                resolvedTrackIdsByDraftTrackId,
                cancellationToken);
            existingRelease.ReplaceExternalSources(draft.ExternalSources);
            IReadOnlyList<ImportReviewIssue> relationWarnings = await AddAcceptedTrackRelationsAsync(
                context,
                collectionId,
                session.Id,
                draft,
                resolvedTrackIdsByDraftTrackId,
                cancellationToken);
            AppendDraftIssues(draft, relationWarnings);
            draft.Confirm(existingRelease.Id);
            await UpdateSessionStatusAsync(context, session, draft, cancellationToken);
            _ = await context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return session;
        }

        Release? partialDuplicateRelease = await FindPartialDuplicateReleaseAsync(context, collectionId, draft, tracks, cancellationToken);
        if (partialDuplicateRelease is not null)
        {
            await AddTracksAsync(context, collectionId, partialDuplicateRelease, draft, tracks, resolvedTrackIdsByDraftTrackId, cancellationToken);
            await AddReleaseFileLinksAsync(
                context,
                collectionId,
                partialDuplicateRelease,
                tracks,
                resolvedTrackIdsByDraftTrackId,
                cancellationToken);
            partialDuplicateRelease.ReplaceExternalSources(draft.ExternalSources);
            IReadOnlyList<ImportReviewIssue> relationWarnings = await AddAcceptedTrackRelationsAsync(
                context,
                collectionId,
                session.Id,
                draft,
                resolvedTrackIdsByDraftTrackId,
                cancellationToken);
            AppendDraftIssues(draft, relationWarnings);
            draft.Confirm(partialDuplicateRelease.Id);
            await UpdateSessionStatusAsync(context, session, draft, cancellationToken);
            _ = await context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return session;
        }

        Release release = await CreateReleaseAsync(context, collectionId, draft, tracks, resolvedTrackIdsByDraftTrackId, cancellationToken);
        IReadOnlyList<ImportReviewIssue> newReleaseRelationWarnings = await AddAcceptedTrackRelationsAsync(
            context,
            collectionId,
            session.Id,
            draft,
            resolvedTrackIdsByDraftTrackId,
            cancellationToken);
        AppendDraftIssues(draft, newReleaseRelationWarnings);
        draft.Confirm(release.Id);
        await UpdateSessionStatusAsync(context, session, draft, cancellationToken);
        _ = await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return session;
    }

    private readonly record struct ConfirmationLockKey(CollectionId CollectionId, Guid SessionId, Guid DraftId);

    private static async Task<Release?> FindExistingReleaseForSelectedTracksAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportDraft draft,
        ReleaseImportDraftTrack[] tracks,
        CancellationToken cancellationToken)
    {
        TrackId[] selectedTrackIds = [.. tracks.Select(track => track.SelectedTrackId).Where(id => id.HasValue).Select(id => id!.Value)];
        if (selectedTrackIds.Length != tracks.Length)
        {
            return null;
        }

        Release[] candidates = await context.Releases
            .Include(release => release.Tracklist)
            .Where(release => release.CollectionId == collectionId && release.Summary.Title == draft.Title)
            .ToArrayAsync(cancellationToken);

        return candidates.FirstOrDefault(release =>
            release.Tracklist.Count == selectedTrackIds.Length &&
            release.Tracklist
                .OrderBy(track => track.Position.Number)
                .Select(track => track.TrackId)
                .SequenceEqual(selectedTrackIds));
    }

    private static async Task<Release?> FindPartialDuplicateReleaseAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportDraft draft,
        ReleaseImportDraftTrack[] tracks,
        CancellationToken cancellationToken)
    {
        TrackId[] selectedTrackIds = [.. tracks.Select(track => track.SelectedTrackId).Where(id => id.HasValue).Select(id => id!.Value)];
        if (selectedTrackIds.Length == 0 || selectedTrackIds.Length >= tracks.Length)
        {
            return null;
        }

        HashSet<TrackId> selectedTrackIdSet = [.. selectedTrackIds];
        Release[] candidates = await context.Releases
            .Include(release => release.Tracklist)
            .Where(release => release.CollectionId == collectionId && release.Summary.Title == draft.Title)
            .ToArrayAsync(cancellationToken);

        return candidates
            .Where(release =>
                release.Tracklist.Count == selectedTrackIdSet.Count &&
                release.Tracklist.All(track => selectedTrackIdSet.Contains(track.TrackId)))
            .OrderByDescending(release => release.Tracklist.Count)
            .FirstOrDefault();
    }

    private static async Task<ReleaseImportDraft?> FindDraftForUpdateAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Guid sessionId,
        Guid draftId,
        CancellationToken cancellationToken)
    {
        var typedSessionId = new ReleaseImportSessionId(sessionId);
        var typedDraftId = new ReleaseImportDraftId(draftId);

        return await context.ReleaseImportDrafts
            .Where(draft =>
                draft.CollectionId == collectionId &&
                draft.SessionId == typedSessionId &&
                draft.Id == typedDraftId)
            .SingleOrDefaultAsync(cancellationToken);
    }

    private async Task<Release> CreateReleaseAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportDraft draft,
        IReadOnlyList<ReleaseImportDraftTrack> draftTracks,
        Dictionary<ReleaseImportDraftTrackId, TrackId> resolvedTrackIdsByDraftTrackId,
        CancellationToken cancellationToken)
    {
        string releaseType = await DictionaryValidation.ResolveOrCreateActiveCodeAsync(
            context,
            collectionId,
            DictionaryKind.ReleaseType,
            draft.Type,
            "release.type_invalid",
            "Release type is invalid",
            cancellationToken);
        IReadOnlyList<string> genres = await ResolveGenreCodesAsync(
            context,
            collectionId,
            draft.Genres,
            cancellationToken);
        var release = Release.Create(collectionId, ReleaseId.New(), draft.Title);
        ReleaseMetadata metadata = ReleaseMetadata.Empty.WithType(releaseType);

        if (draft.Year is { } year)
        {
            metadata = metadata.WithReleaseYear(year);
        }

        if (draft.ReleaseDate is { } releaseDate)
        {
            metadata = metadata.WithReleaseDate(releaseDate);
        }

        metadata = await ApplyCoverAsync(metadata, release.Id, collectionId, draft, cancellationToken);
        release.UpdateSummary(release.Summary.WithMetadata(metadata));
        release.UpdateArtistDisplay(draft.IsVariousArtists);
        release.UpdateCataloging(CatalogingMapper.Create(genres, draft.Tags));
        release.UpdateLabels(draft.NotOnLabel, await ResolveLabelsAsync(context, collectionId, draft, cancellationToken));
        release.ReplaceExternalSources(draft.ExternalSources);

        _ = context.Releases.Add(release);
        await AddReleaseCreditsAsync(context, collectionId, release, draft, cancellationToken);
        await AddTracksAsync(context, collectionId, release, draft, draftTracks, resolvedTrackIdsByDraftTrackId, cancellationToken);
        await AddReleaseFileLinksAsync(
            context,
            collectionId,
            release,
            draftTracks,
            resolvedTrackIdsByDraftTrackId,
            cancellationToken);

        return release;
    }

    private static async Task<IReadOnlyList<string>> ResolveGenreCodesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyList<string>? genres,
        CancellationToken cancellationToken)
    {
        if (genres is null || genres.Count == 0)
        {
            return [];
        }

        string[] requestedCodes =
        [
            .. genres
                .Select(genre => string.IsNullOrWhiteSpace(genre)
                    ? throw new DomainException("release.genre_invalid", "Release genre is invalid")
                    : genre.Trim())
                .Distinct(StringComparer.Ordinal)
        ];

        var resolved = new List<string>(requestedCodes.Length);
        foreach (string code in requestedCodes)
        {
            resolved.Add(await DictionaryValidation.ResolveOrCreateActiveCodeAsync(
                context,
                collectionId,
                DictionaryKind.Genre,
                code,
                "release.genre_invalid",
                "Release genre is invalid",
                cancellationToken));
        }

        return resolved;
    }
}
