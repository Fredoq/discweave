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
    private static Task<IResult> RebindExternalMusicBrainzAsync(
        Guid sessionId,
        Guid draftId,
        ExternalMusicBrainzBindingRebindRequest request,
        ExternalReleaseBindingRebindService service,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        return RebindExternalAsync(
            () => service.RebindMusicBrainzAsync(
                currentCollection.CollectionId,
                sessionId,
                draftId,
                request,
                cancellationToken),
            context,
            currentCollection,
            cancellationToken);
    }

    private static Task<IResult> RebindExternalDiscogsAsync(
        Guid sessionId,
        Guid draftId,
        ExternalDiscogsBindingRebindRequest request,
        ExternalReleaseBindingRebindService service,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        return RebindExternalAsync(
            () => service.RebindDiscogsAsync(
                currentCollection.CollectionId,
                sessionId,
                draftId,
                request,
                cancellationToken),
            context,
            currentCollection,
            cancellationToken);
    }

    private static Task<IResult> AttachExternalDiscogsReleaseAsync(
        Guid sessionId,
        Guid draftId,
        ExternalDiscogsReleaseAttachRequest request,
        ExternalReleaseBindingRebindService service,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        return RebindExternalAsync(
            () => service.AttachDiscogsReleaseAsync(
                currentCollection.CollectionId,
                sessionId,
                draftId,
                request,
                cancellationToken),
            context,
            currentCollection,
            cancellationToken);
    }

    private static async Task<IResult> RebindExternalAsync(
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
                    "import.external_binding_stale" or
                    "import.external_binding_ambiguous" => EndpointErrors.Conflict(exception.Code, exception.Message),
                _ => EndpointErrors.BadRequest(exception.Code, exception.Message)
            };
        }
    }
}
