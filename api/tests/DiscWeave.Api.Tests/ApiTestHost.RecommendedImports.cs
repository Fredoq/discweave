using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Tests;

internal sealed partial class ApiTestHost
{
    public async Task<int> RecommendedSecondDiscTrackNumberAsync()
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        Release release = await context.Releases.SingleAsync(release => release.CollectionId == DefaultCollectionId);
        return release.Tracklist.Single(row => row.Position.Disc.Match(disc => disc == "2", () => false)).Position.Number;
    }

    public async Task SeedRecommendedMasterEditionAsync(bool remix)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        var release = Release.Create(DefaultCollectionId, ReleaseId.New(), "A verified release");
        release.ReplaceExternalSources([ExternalSourceReference.Create("discogs", "master", "99",
            "https://www.discogs.com/master/99", DateTimeOffset.UtcNow)]);
        release.ReplaceTracklist([ReleaseTrack.CreateReleaseOnly(ReleaseTrackId.New(), TrackPosition.FromNumber(1),
            remix ? "A recording (Remix)" : "A recording", TrackDetails.Empty)]);
        _ = context.Releases.Add(release);
        _ = await context.SaveChangesAsync();
    }

    public async Task SeedRecommendedReleaseProvenanceAsync(bool foreign)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        CollectionId collectionId = foreign ? CollectionId.New() : DefaultCollectionId;
        if (foreign)
        {
            _ = context.MusicCollections.Add(MusicCollection.Create(collectionId, UserId.New(), "Foreign collection"));
        }

        var release = Release.Create(collectionId, ReleaseId.New(), "Previously cataloged release");
        release.ReplaceExternalSources([ExternalSourceReference.Create("discogs", "release", "12345",
            "https://www.discogs.com/release/12345", DateTimeOffset.UtcNow)]);
        _ = context.Releases.Add(release);
        _ = context.OwnedItems.Add(OwnedItem.Create(collectionId, OwnedItemId.New(), release.Id,
            OwnershipStatus.Wanted, DigitalFile.Create()));
        _ = await context.SaveChangesAsync();
    }
}
