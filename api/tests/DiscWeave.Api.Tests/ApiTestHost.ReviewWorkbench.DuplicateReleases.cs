using System.Text.Json;
using DiscWeave.Api.Features.ReviewWorkbench;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Review;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Api.Tests;

internal sealed partial class ApiTestHost
{
    public async Task SetReviewReleaseSourceAsync(Guid releaseId, string resourceType, params string[] externalIds)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        Release release = await context.Releases.SingleAsync(release => release.CollectionId == DefaultCollectionId && release.Id == new ReleaseId(releaseId));
        release.ReplaceExternalSources([.. externalIds.Select(externalId => ExternalSourceReference.Create("discogs", resourceType, externalId,
            $"https://www.discogs.com/{resourceType}/{externalId}", DateTimeOffset.UtcNow))]);
        _ = await context.SaveChangesAsync();
    }

    public async Task<string> SeedLegacyReleaseDuplicateAsync(Guid[] releaseIds, string title, string status)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        ReviewWorkbenchSignalTarget[] targets = [.. releaseIds.Select(id => new ReviewWorkbenchSignalTarget
        {
            Id = id,
            Kind = ReviewWorkbenchTargetKinds.Release,
            Title = title
        })];
        string key = ReviewWorkbenchStableKey.Create(DefaultCollectionId, "duplicateCandidates", "duplicateReleases", "catalogQuality", targets, title);
        DateTimeOffset now = DateTimeOffset.UtcNow.AddDays(-1);
        var state = CollectionReviewIssueState.Create(DefaultCollectionId, CollectionReviewIssueStateId.New(), new CollectionReviewIssueSnapshot
        {
            StableKey = key,
            Category = "duplicateCandidates",
            Subtype = "duplicateReleases",
            SourceDetector = "catalogQuality",
            Title = $"Duplicate release title: {title}",
            TargetsJson = JsonSerializer.Serialize(targets, JsonSerializerOptions.Web)
        }, now);
        const string note = "Keep my release decision";
        switch (status)
        {
            case "open":
                break;
            case "dismissed":
                state.Dismiss(now, note);
                break;
            case "resolved":
                state.ResolveByUser(now, note);
                break;
            case "reopened":
                state.Reopen(now, note);
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(status), status, "Unsupported review state");
        }
        _ = context.CollectionReviewIssueStates.Add(state);
        _ = await context.SaveChangesAsync();
        return key;
    }

    public async Task<string> ReviewIssueNoteAsync(string key)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        return await context.CollectionReviewIssueStates.Where(state => state.CollectionId == DefaultCollectionId && state.StableKey == key)
            .Select(state => state.Note).SingleAsync();
    }
}
