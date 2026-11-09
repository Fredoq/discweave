using DiscWeave.Domain.Review;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Tests;

internal sealed partial class ApiTestHost
{
    public async Task ChangeReviewImportFileMappingAsync(string path, bool ambiguous, CancellationToken cancellationToken = default)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        LocalAudioFile[] files = await context.LocalAudioFiles
            .Where(file => file.CollectionId == DefaultCollectionId)
            .ToArrayAsync(cancellationToken);
        LocalAudioFile file = files.Single(candidate => candidate.Path.Value == path);
        DigitalTrackFileLink link = await context.DigitalTrackFileLinks.SingleAsync(
            candidate => candidate.CollectionId == DefaultCollectionId && candidate.LocalAudioFileId == file.Id,
            cancellationToken);
        if (ambiguous)
        {
            DigitalTrackFileLink other = await context.DigitalTrackFileLinks.SingleAsync(
                candidate => candidate.CollectionId == DefaultCollectionId &&
                    candidate.DigitalOwnedItemId == link.DigitalOwnedItemId && candidate.Id != link.Id,
                cancellationToken);
            OwnedItem existingItem = await context.OwnedItems.SingleAsync(
                item => item.CollectionId == DefaultCollectionId && item.Id == link.DigitalOwnedItemId,
                cancellationToken);
            var additionalItem = OwnedItem.Create(DefaultCollectionId, OwnedItemId.New(),
                existingItem.ReleaseId, OwnershipStatus.Owned, DigitalFile.Create());
            _ = context.OwnedItems.Add(additionalItem);
            _ = context.DigitalTrackFileLinks.Add(DigitalTrackFileLink.Create(
                DefaultCollectionId, DigitalTrackFileLinkId.New(), additionalItem.Id, other.ReleaseTrackId, file.Id));
        }
        else
        {
            _ = context.DigitalTrackFileLinks.Remove(link);
        }

        _ = await context.SaveChangesAsync(cancellationToken);
    }

    public async Task<string> SeedStaleReviewIssueStateAsync(CancellationToken cancellationToken = default)
    {
        string stableKey = new('b', 64);
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        var state = CollectionReviewIssueState.Create(
            DefaultCollectionId,
            CollectionReviewIssueStateId.New(),
            new CollectionReviewIssueSnapshot
            {
                StableKey = stableKey,
                Category = "missingMetadata",
                Subtype = "tracksMissingDuration",
                Title = "Stale review issue",
                SourceDetector = "catalogQuality",
                TargetsJson = "[]"
            },
            DateTimeOffset.UtcNow.AddDays(-1));

        _ = context.CollectionReviewIssueStates.Add(state);
        _ = await context.SaveChangesAsync(cancellationToken);

        return stableKey;
    }
}
