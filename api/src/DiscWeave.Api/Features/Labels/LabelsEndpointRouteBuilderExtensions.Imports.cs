using DiscWeave.Api.Http;
using DiscWeave.Api.Features.Maintenance;
using DiscWeave.Application.Errors;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Labels;

public static partial class LabelsEndpointRouteBuilderExtensions
{
    private static void MapLabelImportsEndpoints(RouteGroupBuilder group)
    {
        _ = group.MapGet("/{labelId:guid}/imports", ListLabelImportsAsync).WithName("ListLabelImports");
        _ = group.MapPut("/{labelId:guid}/imports/{sessionId:guid}", LinkLabelImportAsync).WithName("LinkLabelImport");
        _ = group.MapDelete("/{labelId:guid}/imports/{sessionId:guid}", UnlinkLabelImportAsync).WithName("UnlinkLabelImport");
    }

    private static async Task<IResult> ListLabelImportsAsync(
        Guid labelId,
        bool? linked,
        int? limit,
        int? offset,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        if (!Pagination.TryNormalize(limit, offset, out int pageLimit, out int pageOffset, out IResult error))
        {
            return error;
        }

        IResult? schemaError = await ArchiveSchemaEndpointRouteBuilderExtensions.RequireLabelImportSchemaAsync(context, cancellationToken);
        if (schemaError is not null)
        {
            return schemaError;
        }

        var label = new LabelId(labelId);
        CollectionId collection = currentCollection.CollectionId;
        if (!await LabelExistsAsync(context, collection, label, cancellationToken))
        {
            return EndpointErrors.NotFound("label.not_found", "Label was not found");
        }

        bool isLinked = linked ?? true;
        IQueryable<ReleaseImportSession> query = context.ReleaseImportSessions.AsNoTracking()
            .Where(session => session.CollectionId == collection && session.SourceKind == ReleaseImportSourceKind.LocalFiles)
            .Where(session => context.LabelImportSessionLinks.Any(link =>
                link.CollectionId == collection && link.LabelId == label && link.SessionId == session.Id) == isLinked);
        int total = await query.CountAsync(cancellationToken);
        var rows = await query.OrderByDescending(session => EF.Property<long>(session, "id"))
            .Skip(pageOffset).Take(pageLimit)
            .Select(session => new
            {
                Session = session,
                PendingDraftCount = context.ReleaseImportDrafts.Count(draft => draft.CollectionId == collection && draft.SessionId == session.Id &&
                    (draft.Status == ReleaseImportDraftStatus.NeedsReview || draft.Status == ReleaseImportDraftStatus.Ready)),
                ConfirmedDraftCount = context.ReleaseImportDrafts.Count(draft => draft.CollectionId == collection && draft.SessionId == session.Id && draft.Status == ReleaseImportDraftStatus.Confirmed),
                SkippedDraftCount = context.ReleaseImportDrafts.Count(draft => draft.CollectionId == collection && draft.SessionId == session.Id && draft.Status == ReleaseImportDraftStatus.Skipped),
                PendingLooseFileCount = context.ReleaseImportLooseFileCandidates.Count(file => file.CollectionId == collection && file.SessionId == session.Id && file.Decision == ReleaseImportLooseFileCandidate.PendingDecision),
            }).ToArrayAsync(cancellationToken);
        LabelImportSessionResponse[] items = [.. rows.Select(row => new LabelImportSessionResponse(
            row.Session.Id.Value,
            row.Session.SourceRoot.Match(value => value, () => string.Empty),
            row.Session.Status.ToString(),
            row.Session.CreatedAt,
            row.Session.UpdatedAt,
            row.Session.ArchivedAt,
            row.PendingDraftCount,
            row.ConfirmedDraftCount,
            row.SkippedDraftCount,
            row.PendingLooseFileCount))];
        return Results.Ok(new ListResponse<LabelImportSessionResponse>(items, pageLimit, pageOffset, total));
    }

    private static async Task<IResult> LinkLabelImportAsync(
        Guid labelId,
        Guid sessionId,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        IResult? schemaError = await ArchiveSchemaEndpointRouteBuilderExtensions.RequireLabelImportSchemaAsync(context, cancellationToken);
        if (schemaError is not null)
        {
            return schemaError;
        }

        var label = new LabelId(labelId);
        var session = new ReleaseImportSessionId(sessionId);
        CollectionId collection = currentCollection.CollectionId;
        if (!await LabelExistsAsync(context, collection, label, cancellationToken))
        {
            return EndpointErrors.NotFound("label.not_found", "Label was not found");
        }

        ReleaseImportSession? source = await context.ReleaseImportSessions.SingleOrDefaultAsync(
            item => item.CollectionId == collection && item.Id == session, cancellationToken);
        if (source is null)
        {
            return EndpointErrors.NotFound("release_import.not_found", "Import session was not found");
        }

        if (source.SourceKind != ReleaseImportSourceKind.LocalFiles)
        {
            return EndpointErrors.BadRequest("label_import.local_files_required", "Only local-file imports can be linked to a label");
        }

        if (!await context.LabelImportSessionLinks.AnyAsync(link => link.CollectionId == collection && link.LabelId == label && link.SessionId == session, cancellationToken))
        {
            var link = LabelImportSessionLink.Create(collection, label, source);
            _ = context.LabelImportSessionLinks.Add(link);
            try
            {
                _ = await context.SaveChangesAsync(cancellationToken);
            }
            catch (ResourceConflictException exception) when (exception.Conflict == ResourceConflictException.IntegrityConstraint)
            {
                context.Entry(link).State = EntityState.Detached;
                if (!await context.LabelImportSessionLinks.AnyAsync(existing => existing.CollectionId == collection && existing.LabelId == label && existing.SessionId == session, cancellationToken))
                {
                    throw;
                }
            }
        }

        return Results.NoContent();
    }

    private static async Task<IResult> UnlinkLabelImportAsync(
        Guid labelId,
        Guid sessionId,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        IResult? schemaError = await ArchiveSchemaEndpointRouteBuilderExtensions.RequireLabelImportSchemaAsync(context, cancellationToken);
        if (schemaError is not null)
        {
            return schemaError;
        }

        var label = new LabelId(labelId);
        var session = new ReleaseImportSessionId(sessionId);
        CollectionId collection = currentCollection.CollectionId;
        if (!await LabelExistsAsync(context, collection, label, cancellationToken) ||
            !await context.ReleaseImportSessions.AnyAsync(item => item.CollectionId == collection && item.Id == session, cancellationToken))
        {
            return EndpointErrors.NotFound("label_import.not_found", "Label or import session was not found");
        }

        _ = await context.LabelImportSessionLinks.Where(link =>
            link.CollectionId == collection && link.LabelId == label && link.SessionId == session).ExecuteDeleteAsync(cancellationToken);
        return Results.NoContent();
    }

    private static Task<bool> LabelExistsAsync(DiscWeaveDbContext context, CollectionId collection, LabelId label, CancellationToken cancellationToken)
    {
        return context.Labels.AnyAsync(item => item.CollectionId == collection && item.Id == label, cancellationToken);
    }
}
