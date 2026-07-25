using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Caching;
using System.Globalization;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class ExternalMetadataRequestCacheTests
{
    [Fact]
    public async Task Success_and_NotFound_results_expire_using_their_respective_ttls()
    {
        using TestCache fixture = new();
        int successCalls = 0;
        int notFoundCalls = 0;
        ExternalMetadataCacheKey successKey = TestCache.Key("recording.search");
        ExternalMetadataCacheKey missingKey = TestCache.Key("recording.lookup");

        _ = await fixture.Cache.GetOrCreateAsync(successKey, TimeSpan.FromMinutes(15), TimeSpan.FromMinutes(3), Success, CancellationToken.None);
        _ = await fixture.Cache.GetOrCreateAsync(successKey, TimeSpan.FromMinutes(15), TimeSpan.FromMinutes(3), Success, CancellationToken.None);
        _ = await fixture.Cache.GetOrCreateAsync(missingKey, TimeSpan.FromMinutes(15), TimeSpan.FromMinutes(3), Missing, CancellationToken.None);
        fixture.Advance(TimeSpan.FromMinutes(4));
        _ = await fixture.Cache.GetOrCreateAsync(successKey, TimeSpan.FromMinutes(15), TimeSpan.FromMinutes(3), Success, CancellationToken.None);
        _ = await fixture.Cache.GetOrCreateAsync(missingKey, TimeSpan.FromMinutes(15), TimeSpan.FromMinutes(3), Missing, CancellationToken.None);
        fixture.Advance(TimeSpan.FromMinutes(11));
        _ = await fixture.Cache.GetOrCreateAsync(successKey, TimeSpan.FromMinutes(15), TimeSpan.FromMinutes(3), Success, CancellationToken.None);

        Assert.Equal(2, successCalls);
        Assert.Equal(2, notFoundCalls);

        Task<ExternalMetadataResult<string>> Success(CancellationToken ignored)
        {
            return Task.FromResult(new ExternalMetadataResult<string>("value" + ++successCalls));
        }

        Task<ExternalMetadataResult<string>> Missing(CancellationToken ignored)
        {
            return Task.FromResult(
                new ExternalMetadataResult<string>(new ExternalMetadataError(ExternalMetadataErrorKind.NotFound, "missing", "Not found" + ++notFoundCalls)));
        }
    }

    [Theory]
    [InlineData(ExternalMetadataErrorKind.Disabled)]
    [InlineData(ExternalMetadataErrorKind.NotConfigured)]
    [InlineData(ExternalMetadataErrorKind.Unauthorized)]
    [InlineData(ExternalMetadataErrorKind.RateLimited)]
    [InlineData(ExternalMetadataErrorKind.Timeout)]
    [InlineData(ExternalMetadataErrorKind.Unavailable)]
    [InlineData(ExternalMetadataErrorKind.InvalidResponse)]
    public async Task Noncacheable_error_results_invoke_the_factory_again(ExternalMetadataErrorKind kind)
    {
        using TestCache fixture = new();
        int calls = 0;
        ExternalMetadataCacheKey key = TestCache.Key("recording.error." + kind);

        _ = await fixture.Cache.GetOrCreateAsync(key, TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(1), Factory, CancellationToken.None);
        _ = await fixture.Cache.GetOrCreateAsync(key, TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(1), Factory, CancellationToken.None);

        Assert.Equal(2, calls);

        Task<ExternalMetadataResult<string>> Factory(CancellationToken ignored)
        {
            return Task.FromResult(
                new ExternalMetadataResult<string>(new ExternalMetadataError(kind, "error", "Expected error " + ++calls)));
        }
    }

    [Fact]
    public async Task Completed_cache_never_keeps_more_than_its_configured_size()
    {
        using TestCache fixture = new();

        for (int index = 0; index < 513; index++)
        {
            int current = index;
            _ = await fixture.Cache.GetOrCreateAsync(
                TestCache.Key("recording.size." + current),
                TimeSpan.FromHours(1),
                TimeSpan.FromMinutes(1),
                ignored => Task.FromResult(new ExternalMetadataResult<string>(current.ToString(CultureInfo.InvariantCulture))),
                CancellationToken.None);
        }

        Assert.InRange(fixture.CompletedCount, 0, 512);
    }

    [Fact]
    public async Task Sixty_fifth_unique_fetch_waits_for_admission_but_its_caller_can_cancel()
    {
        using TestCache fixture = new();
        TaskCompletionSource<bool> entered = NewBarrier<bool>();
        TaskCompletionSource<bool> release = NewBarrier<bool>();
        TaskCompletionSource<bool> sixtyFifthStarted = NewBarrier<bool>();
        int active = 0;
        List<Task<ExternalMetadataResult<string>>> firstSixtyFour = [];

        for (int index = 0; index < 64; index++)
        {
            int current = index;
            firstSixtyFour.Add(fixture.Cache.GetOrCreateAsync(
                TestCache.Key("recording.admission." + current), TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(1), Block, CancellationToken.None));
        }

        _ = await entered.Task;
        using CancellationTokenSource cancellation = new();
        Task<ExternalMetadataResult<string>> queued = fixture.Cache.GetOrCreateAsync(
            TestCache.Key("recording.admission.65"), TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(1), SixtyFifth, cancellation.Token);
        cancellation.Cancel();
        _ = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => queued);
        Assert.False(sixtyFifthStarted.Task.IsCompleted);

        _ = release.TrySetResult(true);
        _ = await sixtyFifthStarted.Task;
        _ = await Task.WhenAll(firstSixtyFour);

        async Task<ExternalMetadataResult<string>> Block(CancellationToken ignored)
        {
            if (Interlocked.Increment(ref active) == 64)
            {
                _ = entered.TrySetResult(true);
            }

            _ = await release.Task;
            return new ExternalMetadataResult<string>("first");
        }

        Task<ExternalMetadataResult<string>> SixtyFifth(CancellationToken ignored)
        {
            _ = sixtyFifthStarted.TrySetResult(true);
            return Task.FromResult(new ExternalMetadataResult<string>("sixty-fifth"));
        }
    }
}
