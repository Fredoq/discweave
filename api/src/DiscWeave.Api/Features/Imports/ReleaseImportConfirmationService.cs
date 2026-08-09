using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Application.Catalog;
using DiscWeave.Application.Catalog.Releases;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ReleaseImportConfirmationService
{
    private const string MainArtistRole = "mainArtist";
    private readonly IReleaseCoverStorage _coverStorage;
    private readonly TrackStackAssignmentService _trackStackAssignmentService;
    private readonly IExternalReleaseBindingValidator _externalBindingValidator;
    private readonly IExternalSourceLookup _externalSourceLookup;
    private readonly TimeProvider _timeProvider;

    public ReleaseImportConfirmationService(
        IReleaseCoverStorage coverStorage,
        TrackStackAssignmentService trackStackAssignmentService,
        IExternalReleaseBindingValidator externalBindingValidator,
        IExternalSourceLookup externalSourceLookup,
        TimeProvider timeProvider)
    {
        _coverStorage = coverStorage;
        _trackStackAssignmentService = trackStackAssignmentService;
        _externalBindingValidator = externalBindingValidator;
        _externalSourceLookup = externalSourceLookup;
        _timeProvider = timeProvider;
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
            .ToArrayAsync(cancellationToken);
        if (draft.SourceKind == ReleaseImportSourceKind.ExternalMetadata)
        {
            await ConfirmExternalMetadataAsync(
                context,
                collectionId,
                session,
                draft,
                tracks,
                cancellationToken);
            _ = await context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return session;
        }

        EnsureSourceSpecificTrackData(draft, tracks);
        IReadOnlyList<ExternalSourceReference> catalogExternalSources =
            ReleaseImportProviderReferenceCatalogMapper.ToCatalog(draft.ExternalSources, DateTimeOffset.UtcNow);
        tracks =
        [
            .. tracks
                .OrderBy(track => track.Position ?? 9999)
                .ThenBy(TrackOrderKey, StringComparer.Ordinal)
        ];
        if (tracks.Length == 0)
        {
            throw new DomainException("release_import.tracks_required", "Release import draft has no tracks to confirm");
        }

        Dictionary<ReleaseImportDraftTrackId, TrackId> resolvedTrackIdsByDraftTrackId = CreateSelectedTrackMap(tracks);
        Dictionary<ReleaseImportDraftTrackId, ReleaseTrackId> resolvedReleaseTrackIdsByDraftTrackId = [];
        Release? existingRelease = await FindExistingReleaseForSelectedTracksAsync(context, collectionId, draft, tracks, cancellationToken);
        if (existingRelease is not null)
        {
            if (draft.SourceKind == ReleaseImportSourceKind.LocalFiles)
            {
                await AddReleaseFileLinksAsync(
                    context,
                    collectionId,
                    existingRelease,
                    tracks,
                    resolvedTrackIdsByDraftTrackId,
                    resolvedReleaseTrackIdsByDraftTrackId,
                    cancellationToken);
            }
            existingRelease.ReplaceExternalSources(catalogExternalSources);
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
            var artistSourceCache = new ImportArtistSourceResolutionCache();
            await SeedSelectedArtistSourceCacheAsync(context, collectionId, draft, artistSourceCache, cancellationToken);
            await AddTracksAsync(
                new TrackMaterializationScope(context, collectionId, draft, artistSourceCache),
                partialDuplicateRelease,
                tracks,
                new ResolvedTrackMaps(resolvedTrackIdsByDraftTrackId, resolvedReleaseTrackIdsByDraftTrackId),
                cancellationToken);
            if (draft.SourceKind == ReleaseImportSourceKind.LocalFiles)
            {
                await AddReleaseFileLinksAsync(
                    context,
                    collectionId,
                    partialDuplicateRelease,
                    tracks,
                    resolvedTrackIdsByDraftTrackId,
                    resolvedReleaseTrackIdsByDraftTrackId,
                    cancellationToken);
            }
            partialDuplicateRelease.ReplaceExternalSources(catalogExternalSources);
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

        Release release = await CreateReleaseAsync(
            context,
            collectionId,
            draft,
            tracks,
            resolvedTrackIdsByDraftTrackId,
            catalogExternalSources,
            cancellationToken);
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

    private static void EnsureSourceSpecificTrackData(
        ReleaseImportDraft draft,
        IEnumerable<ReleaseImportDraftTrack> tracks)
    {
        foreach (ReleaseImportDraftTrack track in tracks)
        {
            if (track.SourceKind != draft.SourceKind)
            {
                throw new InvalidOperationException("Source kind mismatch between release import draft and track");
            }

            if (track.SourceKind == ReleaseImportSourceKind.LocalFiles)
            {
                _ = RequiredLocalFile(track);
            }
        }
    }

    private static string TrackOrderKey(ReleaseImportDraftTrack track)
    {
        return track.SourceKind == ReleaseImportSourceKind.LocalFiles
            ? RequiredLocalFile(track).RelativePath
            : track.Title;
    }

    private static ReleaseImportLocalFileDescriptor RequiredLocalFile(ReleaseImportDraftTrack track)
    {
        return track.LocalFile is PresentOptionalValue<ReleaseImportLocalFileDescriptor> localFile
            ? localFile.Value
            : throw new DomainException(
                "release_import.local_file_required",
                "Local file import track is missing its local file descriptor");
    }

}
