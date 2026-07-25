using DiscWeave.Infrastructure.ExternalMetadata.Caching;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzLineageMappingTests
{
    private sealed class ProviderHarness : IDisposable
    {
        private readonly HttpClient _httpClient;
        private readonly MemoryCache _memoryCache;
        private readonly ExternalMetadataRequestCache _cache;

        public ProviderHarness(
            CapturingHandler handler,
            MusicBrainzOptions options,
            TimeProvider? timeProvider = null)
        {
            TimeProvider clock = timeProvider ?? TimeProvider.System;
            _httpClient = new HttpClient(handler) { BaseAddress = new Uri(options.BaseUrl) };
            _memoryCache = new MemoryCache(new MemoryCacheOptions { SizeLimit = 128 });
            _cache = new ExternalMetadataRequestCache(_memoryCache, clock);
            Provider = new MusicBrainzExternalMetadataProvider(
                _httpClient,
                Options.Create(options),
                new ImmediateRequestGate(),
                _cache,
                clock);
        }

        public MusicBrainzExternalMetadataProvider Provider { get; }

        public void Dispose()
        {
            _httpClient.Dispose();
            _cache.Dispose();
            _memoryCache.Dispose();
        }
    }

    private sealed class ImmediateRequestGate : IMusicBrainzRequestGate
    {
        public ValueTask WaitAsync(CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return ValueTask.CompletedTask;
        }

        public void Defer(TimeSpan retryAfter)
        {
        }
    }

    private sealed class CapturingHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> _response;
        private int _callCount;

        public CapturingHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> response)
        {
            _response = response;
        }

        public List<HttpRequestMessage> Requests { get; } = [];

        public int CallCount => Volatile.Read(ref _callCount);

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            Requests.Add(request);
            _ = Interlocked.Increment(ref _callCount);
            return _response(request, cancellationToken);
        }
    }
}
