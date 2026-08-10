using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Caching;
using Microsoft.Extensions.Caching.Memory;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class ExternalMetadataRequestCacheTests
{
    [Fact]
    public async Task Disposing_while_a_fetch_is_admitted_does_not_break_its_release()
    {
        using MemoryCache completed = new(new MemoryCacheOptions { SizeLimit = 512 });
        using ExternalMetadataRequestCache cache = new(completed, TimeProvider.System);
        TaskCompletionSource entered = new(TaskCreationOptions.RunContinuationsAsynchronously);
        TaskCompletionSource release = new(TaskCreationOptions.RunContinuationsAsynchronously);

        Task<ExternalMetadataResult<string>> operation = cache.GetOrCreateAsync(
            TestCache.Key("recording.dispose-race"),
            TimeSpan.FromMinutes(1),
            TimeSpan.FromMinutes(1),
            FetchAsync,
            CancellationToken.None);

        await entered.Task;
        cache.Dispose();
        _ = release.TrySetResult();

        ExternalMetadataResult<string> result = await operation;
        Assert.Equal("completed", result.Value);

        async Task<ExternalMetadataResult<string>> FetchAsync(CancellationToken ignored)
        {
            _ = entered.TrySetResult();
            await release.Task;
            return new ExternalMetadataResult<string>("completed");
        }
    }

    [Fact]
    public async Task Caller_that_misses_before_a_later_cache_publication_does_not_run_a_second_factory()
    {
        using BlockingFirstLookupCache completed = new();
        using ExternalMetadataRequestCache cache = new(completed, TimeProvider.System);
        ExternalMetadataCacheKey key = TestCache.Key("recording.publication-race");
        int firstFactoryCalls = 0;
        int secondFactoryCalls = 0;

        Task<ExternalMetadataResult<string>> first = Task.Run(() => cache.GetOrCreateAsync(
            key,
            TimeSpan.FromMinutes(1),
            TimeSpan.FromMinutes(1),
            FirstFactory,
            CancellationToken.None));
        _ = await completed.FirstLookupReached.Task;

        ExternalMetadataResult<string> second = await cache.GetOrCreateAsync(
            key,
            TimeSpan.FromMinutes(1),
            TimeSpan.FromMinutes(1),
            SecondFactory,
            CancellationToken.None);
        _ = completed.ReleaseFirstLookup.TrySetResult(true);
        ExternalMetadataResult<string> firstResult = await first;

        Assert.Equal("second", second.Value);
        Assert.Equal("second", firstResult.Value);
        Assert.Equal(0, firstFactoryCalls);
        Assert.Equal(1, secondFactoryCalls);

        Task<ExternalMetadataResult<string>> FirstFactory(CancellationToken ignored)
        {
            firstFactoryCalls++;
            return Task.FromResult(new ExternalMetadataResult<string>("first"));
        }

        Task<ExternalMetadataResult<string>> SecondFactory(CancellationToken ignored)
        {
            secondFactoryCalls++;
            return Task.FromResult(new ExternalMetadataResult<string>("second"));
        }
    }

    private sealed class BlockingFirstLookupCache : IMemoryCache
    {
        private readonly MemoryCache _inner = new(new MemoryCacheOptions { SizeLimit = 512 });
        private int _firstLookup = 1;

        public TaskCompletionSource<bool> FirstLookupReached { get; } = NewBarrier<bool>();

        public TaskCompletionSource<bool> ReleaseFirstLookup { get; } = NewBarrier<bool>();

        public bool TryGetValue(object key, out object? value)
        {
            if (Interlocked.Exchange(ref _firstLookup, 0) == 1)
            {
                bool found = _inner.TryGetValue(key, out value);
                _ = FirstLookupReached.TrySetResult(true);
                _ = ReleaseFirstLookup.Task.GetAwaiter().GetResult();
                return found;
            }

            return _inner.TryGetValue(key, out value);
        }

        public ICacheEntry CreateEntry(object key)
        {
            return _inner.CreateEntry(key);
        }

        public void Remove(object key)
        {
            _inner.Remove(key);
        }

        public void Dispose()
        {
            _inner.Dispose();
        }
    }
}
