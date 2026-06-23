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
    private const string EmptyIssuesJson = "[]";
    private const string IssuesJsonProperty = "_issuesJson";

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
        IQueryable<ReleaseImportSession> query = context.ReleaseImportSessions.AsNoTracking()
            .Where(session =>
                session.CollectionId == currentCollection.CollectionId &&
                (showArchived || session.ArchivedAt == null));

        query = ApplyImportSessionFilter(query, filter, context, currentCollection.CollectionId);
        int total = await query.CountAsync(cancellationToken);
        ReleaseImportSession[] sessions = await query
            .OrderByDescending(session => EF.Property<long>(session, "id"))
            .Skip(pageOffset)
            .Take(pageLimit)
            .ToArrayAsync(cancellationToken);
        ReleaseImportSessionId[] sessionIds = [.. sessions.Select(session => session.Id)];
        ReleaseImportScanDiagnostic[] diagnostics = await LoadSessionDiagnosticsAsync(
            context,
            currentCollection.CollectionId,
            sessionIds,
            cancellationToken);
        ILookup<ReleaseImportSessionId, ReleaseImportScanDiagnostic> diagnosticsBySession =
            diagnostics.ToLookup(diagnostic => diagnostic.SessionId);
        ReleaseImportSessionResponse[] page =
        [
            .. sessions
                .Select(session => ReleaseImportResponseMapper.ToSessionResponse(
                    session,
                    [.. diagnosticsBySession[session.Id]]))
        ];

        return Results.Ok(new ListResponse<ReleaseImportSessionResponse>(
            page,
            pageLimit,
            pageOffset,
            total));
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

    private static bool IsValidImportSessionFilter(string? filter)
    {
        return NormalizedImportSessionFilter(filter) is null or "ready" or "confirmed" or "skipped" or
            "hasloosefiles" or "haswarningsorerrors" or "missinghashes" or "duplicatematches";
    }

    private static IQueryable<ReleaseImportSession> ApplyImportSessionFilter(
        IQueryable<ReleaseImportSession> query,
        string? filter,
        DiscWeaveDbContext context,
        CollectionId collectionId)
    {
        return NormalizedImportSessionFilter(filter) switch
        {
            null => query,
            "ready" => ReadyImportSessions(query),
            "confirmed" => ConfirmedImportSessions(query, context, collectionId),
            "skipped" => SkippedImportSessions(query, context, collectionId),
            "hasloosefiles" => query.Where(session => session.LooseFileCandidateCount > 0),
            "haswarningsorerrors" => WarningOrErrorImportSessions(query, context, collectionId),
            "missinghashes" => IssueCodeImportSessions(query, context, collectionId, ImportIssueCodes.ContentHashMissing),
            "duplicatematches" => DuplicateMatchImportSessions(query, context, collectionId),
            _ => query.Where(_ => false)
        };
    }

    private static IQueryable<ReleaseImportSession> ReadyImportSessions(IQueryable<ReleaseImportSession> query)
    {
        return query.Where(session => session.Status == ReleaseImportSessionStatus.ReadyForReview);
    }

    private static IQueryable<ReleaseImportSession> ConfirmedImportSessions(
        IQueryable<ReleaseImportSession> query,
        DiscWeaveDbContext context,
        CollectionId collectionId)
    {
        return query.Where(session => context.ReleaseImportDrafts.Any(draft =>
            draft.CollectionId == collectionId &&
            draft.SessionId == session.Id &&
            draft.Status == ReleaseImportDraftStatus.Confirmed));
    }

    private static IQueryable<ReleaseImportSession> SkippedImportSessions(
        IQueryable<ReleaseImportSession> query,
        DiscWeaveDbContext context,
        CollectionId collectionId)
    {
        return query.Where(session =>
            context.ReleaseImportDrafts.Any(draft =>
                draft.CollectionId == collectionId &&
                draft.SessionId == session.Id) &&
            !context.ReleaseImportDrafts.Any(draft =>
                draft.CollectionId == collectionId &&
                draft.SessionId == session.Id &&
                draft.Status != ReleaseImportDraftStatus.Skipped));
    }

    private static IQueryable<ReleaseImportSession> WarningOrErrorImportSessions(
        IQueryable<ReleaseImportSession> query,
        DiscWeaveDbContext context,
        CollectionId collectionId)
    {
        return query.Where(session =>
            context.ReleaseImportScanDiagnostics.Any(diagnostic =>
                diagnostic.CollectionId == collectionId &&
                diagnostic.SessionId == session.Id &&
                (diagnostic.Severity == ReleaseImportScanDiagnosticSeverity.Warning ||
                    diagnostic.Severity == ReleaseImportScanDiagnosticSeverity.Error)) ||
            context.ReleaseImportDrafts.Any(draft =>
                draft.CollectionId == collectionId &&
                draft.SessionId == session.Id &&
                EF.Property<string>(draft, IssuesJsonProperty) != EmptyIssuesJson) ||
            context.ReleaseImportDraftTracks.Any(track =>
                track.CollectionId == collectionId &&
                EF.Property<string>(track, IssuesJsonProperty) != EmptyIssuesJson &&
                context.ReleaseImportDrafts.Any(draft =>
                    draft.CollectionId == collectionId &&
                    draft.SessionId == session.Id &&
                    draft.Id == track.DraftId)));
    }

    private static IQueryable<ReleaseImportSession> IssueCodeImportSessions(
        IQueryable<ReleaseImportSession> query,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        string issueCode)
    {
        string pattern = $"%{issueCode}%";
        return query.Where(session =>
            context.ReleaseImportDrafts.Any(draft =>
                draft.CollectionId == collectionId &&
                draft.SessionId == session.Id &&
                EF.Functions.Like(EF.Property<string>(draft, IssuesJsonProperty), pattern)) ||
            context.ReleaseImportDraftTracks.Any(track =>
                track.CollectionId == collectionId &&
                EF.Functions.Like(EF.Property<string>(track, IssuesJsonProperty), pattern) &&
                context.ReleaseImportDrafts.Any(draft =>
                    draft.CollectionId == collectionId &&
                    draft.SessionId == session.Id &&
                    draft.Id == track.DraftId)));
    }

    private static IQueryable<ReleaseImportSession> DuplicateMatchImportSessions(
        IQueryable<ReleaseImportSession> query,
        DiscWeaveDbContext context,
        CollectionId collectionId)
    {
        string pattern = $"%{DuplicateImportIssueCode}%";
        return query.Where(session =>
            context.ReleaseImportDraftTracks.Any(track =>
                track.CollectionId == collectionId &&
                (track.SelectedTrackId.HasValue ||
                    EF.Functions.Like(EF.Property<string>(track, IssuesJsonProperty), pattern)) &&
                context.ReleaseImportDrafts.Any(draft =>
                    draft.CollectionId == collectionId &&
                    draft.SessionId == session.Id &&
                    draft.Id == track.DraftId)));
    }

    private static string? NormalizedImportSessionFilter(string? filter)
    {
        return string.IsNullOrWhiteSpace(filter) || string.Equals(filter, "all", StringComparison.OrdinalIgnoreCase)
            ? null
            : filter.Replace("-", string.Empty, StringComparison.Ordinal).Trim().ToLowerInvariant();
    }

}
