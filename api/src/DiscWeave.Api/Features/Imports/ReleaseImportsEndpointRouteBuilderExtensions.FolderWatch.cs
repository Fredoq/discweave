using DiscWeave.Api.Http;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportsEndpointRouteBuilderExtensions
{
    private const string ReleaseImportNotFoundCode = "release_import.not_found";
    private const string ReleaseImportNotFoundMessage = "Release import session was not found";

    private static async Task<IResult> GetFolderBaselineAsync(
        Guid sessionId,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        ReleaseImportSession? session = await FindSessionAsync(context, currentCollection.CollectionId, sessionId, cancellationToken);
        ReleaseImportFolderBaselineResponse? baseline = session is null
            ? null
            : await ReleaseImportFolderBaselineService.LoadAsync(session, context, cancellationToken);

        return baseline is null
            ? EndpointErrors.NotFound(ReleaseImportNotFoundCode, ReleaseImportNotFoundMessage)
            : Results.Ok(baseline);
    }

    private static async Task<IResult> AppendDesktopFolderScanAsync(
        Guid sessionId,
        DesktopFolderScanAppendRequest request,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        try
        {
            ReleaseImportSession? session = await ReleaseImportScanService.AppendDesktopAsync(
                sessionId,
                request,
                context,
                currentCollection.CollectionId,
                cancellationToken);

            return session is null
                ? EndpointErrors.NotFound(ReleaseImportNotFoundCode, ReleaseImportNotFoundMessage)
                : Results.Ok(await ReleaseImportResponseMapper.ToDetailResponseAsync(
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
