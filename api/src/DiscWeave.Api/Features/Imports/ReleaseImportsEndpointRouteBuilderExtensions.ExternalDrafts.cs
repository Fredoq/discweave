using DiscWeave.Api.Http;
using DiscWeave.Api.Features.ExternalMetadata;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportsEndpointRouteBuilderExtensions
{
    private static async Task<IResult> CreateExternalReleaseDraftAsync(
        ExternalReleaseDraftRequest request,
        ExternalReleaseDraftService service,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        try
        {
            ReleaseImportSession session = await service.CreateAsync(
                currentCollection.CollectionId,
                request,
                cancellationToken);
            return Results.Created(
                $"/api/imports/{session.Id.Value}",
                await ReleaseImportResponseMapper.ToDetailResponseAsync(
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
                "track.not_found" => EndpointErrors.NotFound(exception.Code, exception.Message),
                "original_discovery.source_not_eligible" => EndpointErrors.Conflict(exception.Code, exception.Message),
                "import.external_binding_stale" or
                    "import.external_binding_ambiguous" or
                    "release_import.idempotency_key_reused" => EndpointErrors.Conflict(exception.Code, exception.Message),
                _ => EndpointErrors.BadRequest(
                    exception.Code == "release_import.idempotency_key_invalid"
                        ? "import.external_request_invalid"
                        : exception.Code,
                    exception.Message)
            };
        }
    }

    private static ExternalMetadataErrorKind ToExternalErrorKind(
        ExternalProviderOperationOutcome outcome)
    {
        return outcome switch
        {
            ExternalProviderOperationOutcome.NotFound => ExternalMetadataErrorKind.NotFound,
            ExternalProviderOperationOutcome.Disabled => ExternalMetadataErrorKind.Disabled,
            ExternalProviderOperationOutcome.NotConfigured => ExternalMetadataErrorKind.NotConfigured,
            ExternalProviderOperationOutcome.Unauthorized => ExternalMetadataErrorKind.Unauthorized,
            ExternalProviderOperationOutcome.UnknownProvider => ExternalMetadataErrorKind.UnknownProvider,
            ExternalProviderOperationOutcome.UnsupportedCapability => ExternalMetadataErrorKind.UnsupportedCapability,
            ExternalProviderOperationOutcome.RateLimited => ExternalMetadataErrorKind.RateLimited,
            ExternalProviderOperationOutcome.Timeout => ExternalMetadataErrorKind.Timeout,
            ExternalProviderOperationOutcome.Unavailable => ExternalMetadataErrorKind.Unavailable,
            ExternalProviderOperationOutcome.InvalidResponse => ExternalMetadataErrorKind.InvalidResponse,
            ExternalProviderOperationOutcome.Succeeded => ExternalMetadataErrorKind.Unavailable,
            _ => ExternalMetadataErrorKind.Unavailable
        };
    }
}
