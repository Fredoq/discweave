using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Caching;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Internal;
using Microsoft.Extensions.Time.Testing;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class ExternalMetadataRequestCacheTests
{
    [Fact]
    public void Create_normalizes_and_hashes_public_arguments_without_retaining_them()
    {
        var first = ExternalMetadataCacheKey.Create(
            " MusicBrainz ",
            " Recording.Search ",
            new Dictionary<string, string>(StringComparer.Ordinal) { ["query"] = "Blue Monday", ["limit"] = "5" });
        var second = ExternalMetadataCacheKey.Create(
            "musicbrainz",
            "recording.search",
            new Dictionary<string, string>(StringComparer.Ordinal) { ["limit"] = "5", ["query"] = "Blue Monday" });

        Assert.Equal(first, second);
        Assert.Equal("musicbrainz", first.ProviderCode);
        Assert.Equal("recording.search", first.Operation);
        Assert.Matches("^[0-9a-f]{64}$", first.PublicArgumentsHash);
        Assert.DoesNotContain("Blue Monday", first.ToString(), StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("token")]
    [InlineData(" Authorization ")]
    [InlineData("collectionId")]
    [InlineData("userId")]
    [InlineData("path")]
    [InlineData("ownership")]
    [InlineData("note")]
    [InlineData("accessToken")]
    [InlineData("apiKey")]
    [InlineData("secret")]
    [InlineData("password")]
    [InlineData("credential")]
    public void Create_rejects_private_argument_names(string argumentName)
    {
        ArgumentException exception = Assert.Throws<ArgumentException>(() => ExternalMetadataCacheKey.Create(
            "musicbrainz",
            "recording.search",
            new Dictionary<string, string> { [argumentName] = "private-value" }));

        Assert.DoesNotContain("private-value", exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Equal_key_callers_share_one_factory_and_individual_cancellation()
    {
        using TestCache fixture = new();
        ExternalMetadataCacheKey key = TestCache.Key("recording.search");
        TaskCompletionSource<ExternalMetadataResult<string>> release = NewBarrier<ExternalMetadataResult<string>>();
        int calls = 0;
        using CancellationTokenSource cancellation = new();

        Task<ExternalMetadataResult<string>> first = fixture.Cache.GetOrCreateAsync(
            key, TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(1), _ => CountThenWaitAsync(), cancellation.Token);
        Task<ExternalMetadataResult<string>> second = fixture.Cache.GetOrCreateAsync(
            key, TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(1), _ => CountThenWaitAsync(), CancellationToken.None);
        cancellation.Cancel();
        _ = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => first);

        _ = release.TrySetResult(new ExternalMetadataResult<string>("cached"));
        Assert.Equal("cached", (await second).Value);
        Assert.Equal(1, calls);

        async Task<ExternalMetadataResult<string>> CountThenWaitAsync()
        {
            calls++;
            return await release.Task;
        }
    }

    [Fact]
    public async Task All_cancelled_waiters_leave_shared_work_to_cache_its_result()
    {
        using TestCache fixture = new();
        ExternalMetadataCacheKey key = TestCache.Key("recording.lookup");
        TaskCompletionSource<ExternalMetadataResult<string>> release = NewBarrier<ExternalMetadataResult<string>>();
        int calls = 0;
        using CancellationTokenSource firstCancellation = new();
        using CancellationTokenSource secondCancellation = new();

        Task<ExternalMetadataResult<string>> first = fixture.Cache.GetOrCreateAsync(key, TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(1), Factory, firstCancellation.Token);
        Task<ExternalMetadataResult<string>> second = fixture.Cache.GetOrCreateAsync(key, TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(1), Factory, secondCancellation.Token);
        firstCancellation.Cancel();
        secondCancellation.Cancel();
        _ = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => first);
        _ = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => second);

        _ = release.TrySetResult(new ExternalMetadataResult<string>("kept"));
        _ = await release.Task;
        ExternalMetadataResult<string> reused = await fixture.Cache.GetOrCreateAsync(key, TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(1), Factory, CancellationToken.None);

        Assert.Equal("kept", reused.Value);
        Assert.Equal(1, calls);

        Task<ExternalMetadataResult<string>> Factory(CancellationToken token)
        {
            Assert.False(token.CanBeCanceled);
            calls++;
            return release.Task;
        }
    }

    [Fact]
    public async Task Factory_exceptions_are_not_cached()
    {
        using TestCache fixture = new();
        ExternalMetadataCacheKey key = TestCache.Key("recording.lookup");
        int calls = 0;

        _ = await Assert.ThrowsAsync<InvalidOperationException>(() => fixture.Cache.GetOrCreateAsync(
            key, TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(1), _ => ThrowAsync(), CancellationToken.None));
        _ = await Assert.ThrowsAsync<InvalidOperationException>(() => fixture.Cache.GetOrCreateAsync(
            key, TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(1), _ => ThrowAsync(), CancellationToken.None));

        Assert.Equal(2, calls);

        Task<ExternalMetadataResult<string>> ThrowAsync()
        {
            calls++;
            throw new InvalidOperationException("expected");
        }
    }

    private static TaskCompletionSource<T> NewBarrier<T>()
    {
        return new TaskCompletionSource<T>(TaskCreationOptions.RunContinuationsAsynchronously);
    }

    private sealed class TestCache : IDisposable
    {
        private readonly FakeTimeProvider _time = new();
        private readonly MemoryCache _memory;

        public TestCache()
        {
            _memory = new MemoryCache(new MemoryCacheOptions
            {
                Clock = new FakeSystemClock(_time),
                ExpirationScanFrequency = TimeSpan.Zero,
                SizeLimit = 512
            });
            Cache = new ExternalMetadataRequestCache(_memory, _time);
        }

        public ExternalMetadataRequestCache Cache { get; }

        public static ExternalMetadataCacheKey Key(string operation)
        {
            return ExternalMetadataCacheKey.Create(
                "musicbrainz", operation, new Dictionary<string, string> { ["id"] = operation });
        }

        public int CompletedCount
        {
            get => _memory.Count;
        }

        public void Advance(TimeSpan elapsed)
        {
            _time.Advance(elapsed);
        }

        public void Dispose()
        {
            _memory.Dispose();
        }
    }

    private sealed class FakeSystemClock : ISystemClock
    {
        private readonly TimeProvider _time;

        public FakeSystemClock(TimeProvider time)
        {
            _time = time;
        }

        public DateTimeOffset UtcNow => _time.GetUtcNow();
    }
}
