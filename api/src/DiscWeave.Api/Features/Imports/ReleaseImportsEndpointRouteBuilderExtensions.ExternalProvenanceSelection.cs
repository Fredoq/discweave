using DiscWeave.Api.Features.ExternalMetadata;
using DiscWeave.Api.Http;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportsEndpointRouteBuilderExtensions
{
    private static async Task<IResult> SelectExternalReleaseProvenanceAsync( // NOSONAR: endpoint dependencies are explicit for collection isolation.
        Guid sessionId,
        Guid draftId,
        Guid releaseId,
        ExternalReviewMutationRequest request,
        ExternalReleaseProvenanceSelectionService service,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        return await SelectExternalProvenanceAsync(
            () => service.SelectReleaseAsync(
                currentCollection.CollectionId,
                sessionId,
                draftId,
                releaseId,
                request,
                cancellationToken),
            context,
            currentCollection,
            cancellationToken);
    }

    private static async Task<IResult> SelectExternalTrackProvenanceAsync( // NOSONAR: endpoint dependencies are explicit for collection isolation.
        Guid sessionId,
        Guid draftId,
        Guid trackId,
        ExternalReviewMutationRequest request,
        ExternalReleaseProvenanceSelectionService service,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        return await SelectExternalProvenanceAsync(
            () => service.SelectTrackAsync(
                currentCollection.CollectionId,
                sessionId,
                draftId,
                trackId,
                request,
                cancellationToken),
            context,
            currentCollection,
            cancellationToken);
    }

    private static async Task<IResult> SelectExternalProvenanceAsync(
        Func<Task<ReleaseImportSession?>> operation,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        try
        {
            ReleaseImportSession? session = await operation();
            return session is null
                ? EndpointErrors.NotFound("release_import_draft.not_found", "Release import draft was not found")
                : Results.Ok(await ReleaseImportResponseMapper.ToDetailResponseAsync(
                    session,
                    context,
                    currentCollection.CollectionId,
                    cancellationToken));
        }
        catch (ExternalReleaseProviderFailureException exception)
        {
            return ExternalMetadataEndpointErrors.ToHttpResult(
                new ExternalMetadataError(
                    ToExternalErrorKind(exception.Status.Outcome),
                    exception.Status.ErrorCode ?? "external_metadata.unavailable",
                    "External metadata provider failed",
                    exception.Status.RetryAfter));
        }
        catch (DomainException exception)
        {
            return exception.Code switch
            {
                "import.review_revision_conflict" or
                    "import.external_provenance_selection_invalid" or
                    "import.external_binding_stale" or
                    "import.external_binding_ambiguous" => EndpointErrors.Conflict(exception.Code, exception.Message),
                _ => EndpointErrors.BadRequest(exception.Code, exception.Message)
            };
        }
    }

}
