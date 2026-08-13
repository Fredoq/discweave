using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Api.Tests;

internal sealed partial class ApiTestHost
{
    public async Task SetExternalDraftTrackPositionsAsync(
        Guid draftId,
        int position,
        CancellationToken cancellationToken = default)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        _ = await context.ReleaseImportDraftTracks
            .Where(track =>
                track.CollectionId == DefaultCollectionId &&
                track.DraftId == new ReleaseImportDraftId(draftId) &&
                track.SourceKind == ReleaseImportSourceKind.ExternalMetadata)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(track => track.Position, position),
                cancellationToken);
    }
}
