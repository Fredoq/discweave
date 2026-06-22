using DiscWeave.Api.Http;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportsEndpointRouteBuilderExtensions
{
    private static async Task<IResult> UpdateRelationSuggestionAsync(
        Guid sessionId,
        Guid suggestionId,
        ReleaseImportRelationSuggestionUpdateRequest request,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        ReleaseImportRelationSuggestion? suggestion = await context.ReleaseImportRelationSuggestions.SingleOrDefaultAsync(
            item =>
                item.CollectionId == currentCollection.CollectionId &&
                item.SessionId == new ReleaseImportSessionId(sessionId) &&
                item.Id == new ReleaseImportRelationSuggestionId(suggestionId),
            cancellationToken);
        if (suggestion is null)
        {
            return EndpointErrors.NotFound("release_import_relation_suggestion.not_found", "Release import relation suggestion was not found");
        }

        await using IAsyncDisposable mutationLock = await ReleaseImportConfirmationService.AcquireDraftMutationLockAsync(
            currentCollection.CollectionId,
            sessionId,
            suggestion.DraftId.Value,
            cancellationToken);

        ReleaseImportDraft? owningDraft = await context.ReleaseImportDrafts.SingleOrDefaultAsync(
            draft =>
                draft.CollectionId == currentCollection.CollectionId &&
                draft.SessionId == new ReleaseImportSessionId(sessionId) &&
                draft.Id == suggestion.DraftId,
            cancellationToken);
        if (owningDraft is null)
        {
            return ReleaseImportDraftNotFound();
        }

        try
        {
            EnsureRelationSuggestionDraftCanChange(owningDraft);
            ReleaseImportRelationSuggestionDecision decision = ParseRelationSuggestionDecision(request.Decision);
            ReleaseImportRelationSuggestionPayload? reviewedPayload = request.Reviewed is null
                ? null
                : await ToValidatedRelationSuggestionPayloadAsync(
                    request.Reviewed,
                    context,
                    currentCollection.CollectionId,
                    new ReleaseImportSessionId(sessionId),
                    owningDraft.Id,
                    decision == ReleaseImportRelationSuggestionDecision.Accepted,
                    cancellationToken);

            ApplyRelationSuggestionDecision(suggestion, decision, reviewedPayload);

            _ = await context.SaveChangesAsync(cancellationToken);
            ReleaseImportSession? session = await FindSessionAsync(context, currentCollection.CollectionId, sessionId, cancellationToken);
            return session is null
                ? EndpointErrors.NotFound("release_import.not_found", "Release import session was not found")
                : Results.Ok(await ReleaseImportResponseMapper.ToDetailResponseAsync(session, context, currentCollection.CollectionId, cancellationToken));
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
    }

    private static void EnsureRelationSuggestionDraftCanChange(ReleaseImportDraft owningDraft)
    {
        if (owningDraft.Status == ReleaseImportDraftStatus.Confirmed)
        {
            throw new DomainException(
                "release_import_relation_suggestion.draft_confirmed",
                "Relation suggestions cannot be changed after the owning draft is confirmed");
        }

        if (owningDraft.Status == ReleaseImportDraftStatus.Skipped)
        {
            throw new DomainException(
                "release_import_relation_suggestion.draft_skipped",
                "Relation suggestions cannot be changed after the owning draft is skipped");
        }
    }

    private static void ApplyRelationSuggestionDecision(
        ReleaseImportRelationSuggestion suggestion,
        ReleaseImportRelationSuggestionDecision decision,
        ReleaseImportRelationSuggestionPayload? reviewedPayload)
    {
        switch (decision)
        {
            case ReleaseImportRelationSuggestionDecision.Pending:
                if (reviewedPayload is null)
                {
                    suggestion.Reset();
                }
                else
                {
                    suggestion.SetPending(reviewedPayload);
                }

                break;

            case ReleaseImportRelationSuggestionDecision.Accepted:
                if (reviewedPayload?.Target is null || string.IsNullOrWhiteSpace(reviewedPayload.RelationTypeCode))
                {
                    throw new DomainException(
                        "release_import_relation_suggestion.reviewed_required",
                        "Accepted relation suggestions require a reviewed target and relation type");
                }

                suggestion.Accept(reviewedPayload);
                break;

            case ReleaseImportRelationSuggestionDecision.Rejected:
                suggestion.Reject();
                break;

            default:
                throw new InvalidOperationException("Relation suggestion decision is not supported");
        }
    }
}
