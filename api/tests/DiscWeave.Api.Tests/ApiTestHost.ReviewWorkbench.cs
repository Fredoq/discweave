using DiscWeave.Domain.Review;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Api.Tests;

internal sealed partial class ApiTestHost
{
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
