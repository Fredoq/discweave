using DiscWeave.Application.Catalog.CoverArtwork;
using DiscWeave.Application.Security;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;

namespace DiscWeave.Api.Features.Imports;

public sealed class ImportCoverEndpointServices
{
    [FromServices]
    public required DiscWeaveDbContext Context { get; init; }

    [FromServices]
    public required ICurrentCollection CurrentCollection { get; init; }

    [FromServices]
    public required ImportCoverArtifactStore Store { get; init; }

    [FromServices]
    public required IExternalCoverArtworkProvider Provider { get; init; }
}
