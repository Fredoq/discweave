using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Api.Tests;

internal sealed partial class ApiTestHost
{
    public async Task<Guid> SeedForeignTrackAsync(
        string title,
        CancellationToken cancellationToken = default)
    {
        await using AsyncServiceScope scope =
            _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context =
            scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        var collectionId = CollectionId.New();
        var track = Track.Create(
            collectionId,
            TrackId.New(),
            title);
        _ = context.MusicCollections.Add(
            MusicCollection.Create(
                collectionId,
                UserId.New(),
                "Foreign collection"));
        _ = context.Tracks.Add(track);
        _ = await context.SaveChangesAsync(cancellationToken);
        return track.Id.Value;
    }
}
