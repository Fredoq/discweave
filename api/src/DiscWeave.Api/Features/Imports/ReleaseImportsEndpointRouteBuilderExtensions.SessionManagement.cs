using DiscWeave.Api.Http;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportsEndpointRouteBuilderExtensions
{
    private const string DeleteImportSessionConfirmation = "delete-abandoned-import-session";
    private const string DuplicateImportIssueCode = "release_import.duplicate_file";

    private static async Task<IResult> ListImportsAsync(
        string? filter,
        bool? includeArchived,
        int? limit,
        int? offset,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        if (!IsValidImportSessionFilter(filter))
        {
            return EndpointErrors.BadRequest("release_import.filter_invalid", "Import session filter is invalid");
        }

        bool showArchived = includeArchived == true;
        int pageLimit = Math.Clamp(limit.GetValueOrDefault(50) <= 0 ? 50 : limit.GetValueOrDefault(50), 1, 200);
        int pageOffset = Math.Max(0, offset.GetValueOrDefault());
        ReleaseImportSession[] sessions = await context.ReleaseImportSessions.AsNoTracking()
            .Where(session =>
                session.CollectionId == currentCollection.CollectionId &&
                (showArchived || session.ArchivedAt == null))
            .ToArrayAsync(cancellationToken);
        ReleaseImportSessionId[] sessionIds = [.. sessions.Select(session => session.Id)];
        ReleaseImportScanDiagnostic[] diagnostics = await LoadSessionDiagnosticsAsync(
            context,
            currentCollection.CollectionId,
            sessionIds,
            cancellationToken);
        ReleaseImportDraft[] drafts = await LoadSessionDraftsAsync(
            context,
            currentCollection.CollectionId,
            sessionIds,
            cancellationToken);
        ReleaseImportDraftTrack[] tracks = await LoadSessionTracksAsync(
            context,
            currentCollection.CollectionId,
            drafts,
            cancellationToken);
        ILookup<ReleaseImportSessionId, ReleaseImportScanDiagnostic> diagnosticsBySession =
            diagnostics.ToLookup(diagnostic => diagnostic.SessionId);
        ILookup<ReleaseImportSessionId, ReleaseImportDraft> draftsBySession =
            drafts.ToLookup(draft => draft.SessionId);
        ILookup<ReleaseImportDraftId, ReleaseImportDraftTrack> tracksByDraft =
            tracks.ToLookup(track => track.DraftId);
        ReleaseImportSession[] filteredSessions =
        [
            .. sessions
                .Where(session => MatchesImportSessionFilter(
                    session,
                    filter,
                    draftsBySession[session.Id],
                    diagnosticsBySession[session.Id],
                    tracksByDraft))
                .OrderByDescending(session => session.CreatedAt)
        ];
        ReleaseImportSessionResponse[] page =
        [
            .. filteredSessions
                .Skip(pageOffset)
                .Take(pageLimit)
                .Select(session => ReleaseImportResponseMapper.ToSessionResponse(
                    session,
                    [.. diagnosticsBySession[session.Id]]))
        ];

        return Results.Ok(new ListResponse<ReleaseImportSessionResponse>(
            page,
            pageLimit,
            pageOffset,
            filteredSessions.Length));
    }

    private static async Task<IResult> ArchiveImportAsync(
        Guid sessionId,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        ReleaseImportSession? session = await FindSessionAsync(context, currentCollection.CollectionId, sessionId, cancellationToken);
        if (session is null)
        {
            return EndpointErrors.NotFound("release_import.not_found", "Release import session was not found");
        }

        session.Archive(DateTimeOffset.UtcNow);
        _ = await context.SaveChangesAsync(cancellationToken);
        return Results.Ok(await ReleaseImportResponseMapper.ToDetailResponseAsync(
            session,
            context,
            currentCollection.CollectionId,
            cancellationToken));
    }

    private static async Task<IResult> DeleteImportAsync(
        Guid sessionId,
        HttpRequest request,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        ReleaseImportSession? session = await FindSessionAsync(context, currentCollection.CollectionId, sessionId, cancellationToken);
        if (session is null)
        {
            return EndpointErrors.NotFound("release_import.not_found", "Release import session was not found");
        }

        string confirmation = request.Headers["X-DiscWeave-Confirm-Delete"].ToString();
        if (!string.Equals(confirmation, DeleteImportSessionConfirmation, StringComparison.Ordinal))
        {
            return EndpointErrors.BadRequest(
                "release_import.delete_confirmation_required",
                "Deleting an abandoned import session requires explicit confirmation");
        }

        bool hasConfirmedDrafts = await context.ReleaseImportDrafts.AsNoTracking().AnyAsync(
            draft =>
                draft.CollectionId == currentCollection.CollectionId &&
                draft.SessionId == session.Id &&
                draft.Status == ReleaseImportDraftStatus.Confirmed,
            cancellationToken);
        if (hasConfirmedDrafts)
        {
            return EndpointErrors.BadRequest(
                "release_import.confirmed_cannot_delete",
                "Confirmed import sessions cannot be deleted because catalog data must remain safe");
        }

        _ = context.ReleaseImportSessions.Remove(session);
        _ = await context.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<ReleaseImportScanDiagnostic[]> LoadSessionDiagnosticsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportSessionId[] sessionIds,
        CancellationToken cancellationToken)
    {
        return sessionIds.Length == 0
            ? []
            : await context.ReleaseImportScanDiagnostics.AsNoTracking()
                .Where(diagnostic => diagnostic.CollectionId == collectionId && sessionIds.Contains(diagnostic.SessionId))
                .OrderBy(diagnostic => diagnostic.Severity)
                .ThenBy(diagnostic => diagnostic.Code)
                .ThenBy(diagnostic => diagnostic.RelativePath)
                .ToArrayAsync(cancellationToken);
    }

    private static async Task<ReleaseImportDraft[]> LoadSessionDraftsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportSessionId[] sessionIds,
        CancellationToken cancellationToken)
    {
        return sessionIds.Length == 0
            ? []
            : await context.ReleaseImportDrafts.AsNoTracking()
                .Where(draft => draft.CollectionId == collectionId && sessionIds.Contains(draft.SessionId))
                .ToArrayAsync(cancellationToken);
    }

    private static async Task<ReleaseImportDraftTrack[]> LoadSessionTracksAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyList<ReleaseImportDraft> drafts,
        CancellationToken cancellationToken)
    {
        ReleaseImportDraftId[] draftIds = [.. drafts.Select(draft => draft.Id)];
        return draftIds.Length == 0
            ? []
            : await context.ReleaseImportDraftTracks.AsNoTracking()
                .Where(track => track.CollectionId == collectionId && draftIds.Contains(track.DraftId))
                .ToArrayAsync(cancellationToken);
    }

    private static bool IsValidImportSessionFilter(string? filter)
    {
        return NormalizedImportSessionFilter(filter) is null or "ready" or "confirmed" or "skipped" or
            "hasloosefiles" or "haswarningsorerrors" or "missinghashes" or "duplicatematches";
    }

    private static bool MatchesImportSessionFilter(
        ReleaseImportSession session,
        string? filter,
        IEnumerable<ReleaseImportDraft> drafts,
        IEnumerable<ReleaseImportScanDiagnostic> diagnostics,
        ILookup<ReleaseImportDraftId, ReleaseImportDraftTrack> tracksByDraft)
    {
        ReleaseImportDraft[] draftArray = [.. drafts];
        return NormalizedImportSessionFilter(filter) switch
        {
            null => true,
            "ready" => session.Status == ReleaseImportSessionStatus.ReadyForReview,
            "confirmed" => draftArray.Any(draft => draft.Status == ReleaseImportDraftStatus.Confirmed),
            "skipped" => draftArray.Length > 0 && draftArray.All(draft => draft.Status == ReleaseImportDraftStatus.Skipped),
            "hasloosefiles" => session.LooseFileCandidateCount > 0,
            "haswarningsorerrors" => HasWarningsOrErrors(draftArray, diagnostics, tracksByDraft),
            "missinghashes" => HasIssue(draftArray, tracksByDraft, ImportIssueCodes.ContentHashMissing),
            "duplicatematches" => HasDuplicateMatch(draftArray, tracksByDraft),
            _ => false
        };
    }

    private static string? NormalizedImportSessionFilter(string? filter)
    {
        return string.IsNullOrWhiteSpace(filter) || string.Equals(filter, "all", StringComparison.OrdinalIgnoreCase)
            ? null
            : filter.Replace("-", string.Empty, StringComparison.Ordinal).Trim().ToLowerInvariant();
    }

    private static bool HasWarningsOrErrors(
        IEnumerable<ReleaseImportDraft> drafts,
        IEnumerable<ReleaseImportScanDiagnostic> diagnostics,
        ILookup<ReleaseImportDraftId, ReleaseImportDraftTrack> tracksByDraft)
    {
        return diagnostics.Any(diagnostic => diagnostic.Severity is ReleaseImportScanDiagnosticSeverity.Warning or ReleaseImportScanDiagnosticSeverity.Error) ||
            drafts.Any(draft => draft.Issues.Count > 0 || tracksByDraft[draft.Id].Any(track => track.Issues.Count > 0));
    }

    private static bool HasIssue(
        IEnumerable<ReleaseImportDraft> drafts,
        ILookup<ReleaseImportDraftId, ReleaseImportDraftTrack> tracksByDraft,
        string code)
    {
        return drafts.Any(draft =>
            draft.Issues.Any(issue => issue.Code == code) ||
            tracksByDraft[draft.Id].Any(track => track.Issues.Any(issue => issue.Code == code)));
    }

    private static bool HasDuplicateMatch(
        IEnumerable<ReleaseImportDraft> drafts,
        ILookup<ReleaseImportDraftId, ReleaseImportDraftTrack> tracksByDraft)
    {
        return drafts.Any(draft => tracksByDraft[draft.Id].Any(track =>
            track.SelectedTrackId.HasValue || track.Issues.Any(issue => issue.Code == DuplicateImportIssueCode)));
    }
}
