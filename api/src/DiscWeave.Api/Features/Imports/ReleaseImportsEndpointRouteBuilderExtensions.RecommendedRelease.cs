using DiscWeave.Api.Http;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportsEndpointRouteBuilderExtensions
{
    private static async Task<IResult> CreateRecommendedReleaseDraftAsync(
        RecommendedReleaseDraftRequest request,
        ExternalReleaseDraftService service,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        try
        {
            ReleaseImportSession session = await service.CreateRecommendedReleaseAsync(
                currentCollection.CollectionId, request, cancellationToken);
            return Results.Created($"/api/imports/{session.Id.Value}",
                await ReleaseImportResponseMapper.ToDetailResponseAsync(session, context,
                    currentCollection.CollectionId, cancellationToken));
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
    }
}
