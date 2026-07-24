using DiscWeave.Api.Features.Settings;
using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Application.Catalog.Releases;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.Settings;
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

    public ReleaseImportConfirmationService(
        IReleaseCoverStorage coverStorage,
        TrackStackAssignmentService trackStackAssignmentService)
    {
        _coverStorage = coverStorage;
        _trackStackAssignmentService = trackStackAssignmentService;
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
        EnsureSourceSpecificTrackData(draft, tracks);
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
        var artistSourceCache = new ImportArtistSourceResolutionCache();
        await AddReleaseCreditsAsync(context, collectionId, release, draft, artistSourceCache, cancellationToken);
        Dictionary<ReleaseImportDraftTrackId, ReleaseTrackId> resolvedReleaseTrackIdsByDraftTrackId = [];
        await AddTracksAsync(
            new TrackMaterializationScope(context, collectionId, draft, artistSourceCache),
            release,
            draftTracks,
            new ResolvedTrackMaps(resolvedTrackIdsByDraftTrackId, resolvedReleaseTrackIdsByDraftTrackId),
            cancellationToken);
        if (draft.SourceKind == ReleaseImportSourceKind.LocalFiles)
        {
            await AddReleaseFileLinksAsync(
                context,
                collectionId,
                release,
                draftTracks,
                resolvedTrackIdsByDraftTrackId,
                resolvedReleaseTrackIdsByDraftTrackId,
                cancellationToken);
        }

        return release;
    }

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
