using System.Collections.Concurrent;
using System.Diagnostics.CodeAnalysis;
using System.Net;
using System.Threading.Channels;
using DiscWeave.Application.Catalog.CoverArtwork;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Caching;
using DiscWeave.Infrastructure.ExternalMetadata.CoverArtArchive;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzSharedDispatchTests
{
    private static readonly TimeSpan TestTimeout = TimeSpan.FromSeconds(10);

    private static HttpResponseMessage JsonResponse([StringSyntax(StringSyntaxAttribute.Json)] string json)
    {
        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json")
        };
    }

    private sealed class ObservedTimeProvider : TimeProvider
    {
        private readonly FakeTimeProvider _time = new();
        private readonly Channel<TimeSpan> _shortTimers = Channel.CreateUnbounded<TimeSpan>();

        public override DateTimeOffset GetUtcNow()
        {
            return _time.GetUtcNow();
        }
        public override long GetTimestamp()
        {
            return _time.GetTimestamp();
        }
        public override long TimestampFrequency => _time.TimestampFrequency;

        public override ITimer CreateTimer(TimerCallback callback, object? state, TimeSpan dueTime, TimeSpan period)
        {
            ITimer timer = _time.CreateTimer(callback, state, dueTime, period);
            if (dueTime > TimeSpan.Zero && dueTime <= TimeSpan.FromSeconds(10))
            {
                _ = _shortTimers.Writer.TryWrite(dueTime);
            }

            return timer;
        }

        public void Advance(TimeSpan amount)
        {
            _time.Advance(amount);
        }
        public Task<TimeSpan> NextDelayAsync()
        {
            return _shortTimers.Reader.ReadAsync().AsTask().WaitAsync(TestTimeout);
        }
    }

    private sealed record Dispatch
    {
        public Dispatch(Uri uri, long timestamp)
        {
            Uri = uri;
            Timestamp = timestamp;
        }

        public Uri Uri { get; }
        public long Timestamp { get; }
    }

    private sealed class DispatchHandler : HttpMessageHandler
    {
        private readonly ObservedTimeProvider _time;
        private readonly Func<HttpRequestMessage, int, CancellationToken, Task<HttpResponseMessage>> _respond;
        private readonly ConcurrentQueue<Dispatch> _dispatches = new();
        private int _count;

        public DispatchHandler(ObservedTimeProvider time, Func<HttpRequestMessage, int, CancellationToken, Task<HttpResponseMessage>> respond)
        {
            _time = time;
            _respond = respond;
        }

        public Dispatch[] Dispatches => [.. _dispatches];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            int number = Interlocked.Increment(ref _count);
            _dispatches.Enqueue(new Dispatch(request.RequestUri ?? throw new InvalidOperationException("A dispatch requires a request URI"), _time.GetTimestamp()));
            return _respond(request, number, cancellationToken);
        }
    }

    private sealed class SharedProviders : IDisposable
    {
        private readonly HttpClient _client;
        private readonly MemoryCache _memory;
        private readonly ExternalMetadataRequestCache _cache;
        private readonly MusicBrainzRequestGate _gate;

        public SharedProviders(ObservedTimeProvider time, DispatchHandler handler)
        {
            IOptions<MusicBrainzOptions> options = Options.Create(new MusicBrainzOptions
            {
                Enabled = true,
                ApplicationVersion = "1.0.0",
                Contact = "https://github.com/Fredoq/discweave",
                MaxRetries = 1,
                MinimumRequestIntervalMilliseconds = 1000
            });
            _client = new HttpClient(handler) { BaseAddress = new Uri("https://musicbrainz.org/") };
            _memory = new MemoryCache(new MemoryCacheOptions { SizeLimit = 128 });
            _cache = new ExternalMetadataRequestCache(_memory, time);
            _gate = new MusicBrainzRequestGate(options, time);
            Cover = new CoverArtArchiveProvider(_client, options, _gate, time);
            Metadata = new MusicBrainzExternalMetadataProvider(_client, options, _gate, _cache, time);
        }

        public CoverArtArchiveProvider Cover { get; }
        public MusicBrainzExternalMetadataProvider Metadata { get; }

        public Task<IReadOnlyList<CoverReleaseCandidate>> SearchCoverAsync()
        {
            return Cover.SearchReleasesAsync(new CoverReleaseSearchQuery("Artist", "Album"), CancellationToken.None);
        }
        public Task<ExternalMetadataResult<MusicBrainzExternalMetadataProvider.RecordingSearchOutcome>> SearchRecordingAsync()
        {
            return Metadata.SearchRecordingsAsync("Recording", ["Artist"], CancellationToken.None);
        }

        public void Dispose()
        {
            _client.Dispose();
            _gate.Dispose();
            _cache.Dispose();
            _memory.Dispose();
        }
    }

    private static void AssertSpaced(ObservedTimeProvider time, Dispatch[] dispatches, int expectedCount)
    {
        Assert.Equal(expectedCount, dispatches.Length);
        for (int index = 1; index < dispatches.Length; index++)
        {
            Assert.True(time.GetElapsedTime(dispatches[index - 1].Timestamp, dispatches[index].Timestamp) >= TimeSpan.FromSeconds(1));
        }
    }
}
