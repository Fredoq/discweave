using DiscWeave.Domain.Review;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Api.Tests;

internal sealed partial class ApiTestHost
{
    public async Task SeedReviewFocusIssuesAsync(params (string Category, string Subtype, int Count)[] groups)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        int index = 0;
        foreach ((string category, string subtype, int count) in groups)
        {
            for (int i = 0; i < count; i++)
            {
                index++;
                var state = CollectionReviewIssueState.Create(
                    DefaultCollectionId,
                    CollectionReviewIssueStateId.New(),
                    new CollectionReviewIssueSnapshot
                    {
                        StableKey = index.ToString("x64", System.Globalization.CultureInfo.InvariantCulture),
                        Category = category,
                        Subtype = subtype,
                        Title = $"Focus fixture {index:D4}",
                        SourceDetector = "catalogQuality",
                        TargetsJson = "[]"
                    },
                    DateTimeOffset.Parse("2026-01-01T00:00:00Z", System.Globalization.CultureInfo.InvariantCulture).AddSeconds(index));
                _ = context.CollectionReviewIssueStates.Add(state);
            }
        }
        _ = await context.SaveChangesAsync();
    }
}
