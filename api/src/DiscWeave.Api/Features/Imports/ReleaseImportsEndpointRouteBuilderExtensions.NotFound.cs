using DiscWeave.Api.Http;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportsEndpointRouteBuilderExtensions
{
    private static IResult ReleaseImportDraftNotFound()
    {
        return EndpointErrors.NotFound(ReleaseImportDraftNotFoundCode, ReleaseImportDraftNotFoundMessage);
    }
}
