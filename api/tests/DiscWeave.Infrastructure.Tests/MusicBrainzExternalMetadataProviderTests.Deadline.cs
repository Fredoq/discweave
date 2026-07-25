using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Caching;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Time.Testing;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzExternalMetadataProviderTests
{
    [Fact]
    public async Task Operation_deadline_bounds_shared_cache_admission_without_cancelling_occupants()
    {
        var timeProvider = new FakeTimeProvider(DateTimeOffset.UtcNow);
        using var cache = new SharedRequestCache(timeProvider);
        TaskCompletionSource allAdmitted = NewSignal();
        TaskCompletionSource releaseOccupants = NewSignal();
        int admitted = 0;
        List<Task<ExternalMetadataResult<string>>> occupants = [];
        Task<ExternalMetadataResult<ExternalMetadataReleaseDetail>>? operation = null;

        for (int index = 0; index < 64; index++)
        {
            int current = index;
            occupants.Add(cache.Cache.GetOrCreateAsync(
                SharedRequestCache.Key($"occupied-{current}"),
                TimeSpan.FromMinutes(1),
                TimeSpan.FromMinutes(1),
                HoldAdmissionAsync,
                CancellationToken.None));
        }

        await allAdmitted.Task.WaitAsync(TimeSpan.FromSeconds(2));
        var handler = new CapturingHandler(
            (_, _) => Task.FromResult(JsonResponse(ReadFixture("release-detail.json"))));
        using var harness = new ProviderHarness(
            handler,
            ValidOptions(operationTimeoutSeconds: 10),
            timeProvider,
            new ImmediateRequestGate(),
            cache.Cache);

        try
        {
            operation = harness.Provider.GetReleaseAsync(
                new ExternalMetadataLookupQuery("10000000-0000-0000-0000-000000000001"),
                CancellationToken.None);
            timeProvider.Advance(TimeSpan.FromSeconds(10));

            ExternalMetadataResult<ExternalMetadataReleaseDetail> result =
                await operation.WaitAsync(TimeSpan.FromSeconds(2));

            Assert.False(result.IsSuccess);
            Assert.Equal(ExternalMetadataErrorKind.Timeout, result.Error.Kind);
            Assert.Equal(0, handler.CallCount);
            Assert.All(occupants, task => Assert.False(task.IsCompleted));
        }
        finally
        {
            _ = releaseOccupants.TrySetResult();
            _ = await Task.WhenAll(occupants).WaitAsync(TimeSpan.FromSeconds(2));
            if (operation is not null)
            {
                _ = await operation.WaitAsync(TimeSpan.FromSeconds(2));
            }
        }

        async Task<ExternalMetadataResult<string>> HoldAdmissionAsync(CancellationToken cancellationToken)
        {
            if (Interlocked.Increment(ref admitted) == 64)
            {
                _ = allAdmitted.TrySetResult();
            }

            await releaseOccupants.Task.WaitAsync(cancellationToken);
            return new ExternalMetadataResult<string>("released");
        }
    }

    [Fact]
    public async Task Follower_deadline_bounds_in_flight_wait_without_cancelling_shared_publication()
    {
        var timeProvider = new FakeTimeProvider(DateTimeOffset.UtcNow);
        using var cache = new SharedRequestCache(timeProvider);
        TaskCompletionSource releaseResponse = NewSignal();
        var ownerHandler = new CapturingHandler(async (_, cancellationToken) =>
        {
            await releaseResponse.Task.WaitAsync(cancellationToken);
            return JsonResponse(ReadFixture("release-detail.json"));
        });
        var followerHandler = new CapturingHandler(
            (_, _) => throw new InvalidOperationException("The equal-key follower must not send."));
        using var owner = new ProviderHarness(
            ownerHandler,
            ValidOptions(operationTimeoutSeconds: 60),
            timeProvider,
            new ImmediateRequestGate(),
            cache.Cache);
        using var follower = new ProviderHarness(
            followerHandler,
            ValidOptions(operationTimeoutSeconds: 10),
            timeProvider,
            new ImmediateRequestGate(),
            cache.Cache);

        Task<ExternalMetadataResult<ExternalMetadataReleaseDetail>> ownerOperation = owner.Provider.GetReleaseAsync(
            new ExternalMetadataLookupQuery("10000000-0000-0000-0000-000000000001"),
            CancellationToken.None);
        await ownerHandler.FirstRequest.WaitAsync(TimeSpan.FromSeconds(2));
        Task<ExternalMetadataResult<ExternalMetadataReleaseDetail>> followerOperation =
            follower.Provider.GetReleaseAsync(
                new ExternalMetadataLookupQuery("10000000-0000-0000-0000-000000000001"),
                CancellationToken.None);

        try
        {
            timeProvider.Advance(TimeSpan.FromSeconds(10));
            ExternalMetadataResult<ExternalMetadataReleaseDetail> timedOut =
                await followerOperation.WaitAsync(TimeSpan.FromSeconds(2));

            Assert.False(timedOut.IsSuccess);
            Assert.Equal(ExternalMetadataErrorKind.Timeout, timedOut.Error.Kind);
            Assert.False(ownerOperation.IsCompleted);
            Assert.Equal(1, ownerHandler.CallCount);
            Assert.Equal(0, followerHandler.CallCount);

            _ = releaseResponse.TrySetResult();
            ExternalMetadataResult<ExternalMetadataReleaseDetail> completed =
                await ownerOperation.WaitAsync(TimeSpan.FromSeconds(2));
            ExternalMetadataResult<ExternalMetadataReleaseDetail> reused = await follower.Provider.GetReleaseAsync(
                new ExternalMetadataLookupQuery("10000000-0000-0000-0000-000000000001"),
                CancellationToken.None);

            Assert.True(completed.IsSuccess);
            Assert.True(reused.IsSuccess);
            Assert.Equal(1, ownerHandler.CallCount);
            Assert.Equal(0, followerHandler.CallCount);
        }
        finally
        {
            _ = releaseResponse.TrySetResult();
            _ = await ownerOperation.WaitAsync(TimeSpan.FromSeconds(2));
            _ = await followerOperation.WaitAsync(TimeSpan.FromSeconds(2));
        }
    }

    private static TaskCompletionSource NewSignal()
    {
        return new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    }

    private sealed class SharedRequestCache : IDisposable
    {
        private readonly MemoryCache _memoryCache;

        public SharedRequestCache(TimeProvider timeProvider)
        {
            _memoryCache = new MemoryCache(new MemoryCacheOptions { SizeLimit = 512 });
            Cache = new ExternalMetadataRequestCache(_memoryCache, timeProvider);
        }

        public ExternalMetadataRequestCache Cache { get; }

        public static ExternalMetadataCacheKey Key(string id)
        {
            return ExternalMetadataCacheKey.Create(
                "musicbrainz",
                "deadline-test",
                new Dictionary<string, string>(StringComparer.Ordinal) { ["id"] = id });
        }

        public void Dispose()
        {
            Cache.Dispose();
            _memoryCache.Dispose();
        }
    }
}
