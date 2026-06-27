using DiscWeave.Api.Http;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportsEndpointRouteBuilderExtensions
{
    private static async Task<IResult> CreateLooseFileDraftAsync(
        Guid sessionId,
        ReleaseImportLooseFileDraftRequest request,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        try
        {
            ReleaseImportSession? session = await ReleaseImportScanService.CreateDraftFromLooseFilesAsync(
                sessionId,
                request,
                context,
                currentCollection.CollectionId,
                cancellationToken);

            return session is null
                ? EndpointErrors.NotFound("release_import.not_found", "Release import session was not found")
                : Results.Created(
                    $"/api/imports/{session.Id.Value}",
                    await ReleaseImportResponseMapper.ToDetailResponseAsync(
                        session,
                        context,
                        currentCollection.CollectionId,
                        cancellationToken));
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
    }
}
