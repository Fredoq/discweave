using DiscWeave.Application.Catalog.CoverArtwork;
using DiscWeave.Application.Catalog.Releases;
using DiscWeave.Application.Security;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;

namespace DiscWeave.Api.Features.Releases;

public sealed class ReleaseCoverEndpointServices
{
    [FromServices]
    public required DiscWeaveDbContext Context { get; init; }
    [FromServices]
    public required ICurrentCollection CurrentCollection { get; init; }
    [FromServices]
    public required IExternalCoverArtworkProvider Provider { get; init; }
    [FromServices]
    public required IReleaseCoverStorage Storage { get; init; }
}
