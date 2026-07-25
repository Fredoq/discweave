using System.Net;
using System.Runtime.CompilerServices;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Caching;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzExternalMetadataProviderTests
{
    [Fact]
    public async Task Recording_search_escapes_each_Lucene_literal_and_encodes_the_completed_query_once()
    {
        string fixture = ReadFixture("recording-search.json");
        var handler = new CapturingHandler((_, _) => Task.FromResult(JsonResponse(fixture)));
        using var harness = new ProviderHarness(handler, ValidOptions());
        const string title = "A \"+ - && || ! (x) {y} [z] ^ ~ * ? : \\ /";
        string[] artists = ["Artist/One", "Artist (Two)"];
        const string expectedQuery =
            "recording:\"A \\\"\\+ \\- \\&\\& \\|\\| \\! \\(x\\) \\{y\\} \\[z\\] \\^ \\~ \\* \\? \\: \\\\ \\/\" AND " +
            "(artist:\"Artist\\/One\" OR artist:\"Artist \\(Two\\)\")";

        ExternalMetadataResult<MusicBrainzExternalMetadataProvider.RecordingSearchOutcome> result =
            await harness.Provider.SearchRecordingsAsync(title, artists, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(
            [
                "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
                "cccccccc-cccc-cccc-cccc-cccccccccccc"
            ],
            result.Value.Recordings.Select(recording => recording.Mbid));
        HttpRequestMessage request = Assert.Single(handler.Requests);
        Assert.Equal(
            $"/ws/2/recording?query={Uri.EscapeDataString(expectedQuery)}&limit=5&offset=0&fmt=json",
            request.RequestUri!.PathAndQuery);
        Assert.Equal("DiscWeave/1.0.0 (https://github.com/Fredoq/discweave)", request.Headers.UserAgent.ToString());
    }

    private static MusicBrainzOptions ValidOptions(
        bool enabled = true,
        int maxRetries = 0,
        int maxRequestsPerOperation = 40,
        int maxRecordingCandidates = 5,
        int maxReleasePages = 5,
        int maxReleaseGroupLookups = 10,
        int operationTimeoutSeconds = 60)
    {
        return new MusicBrainzOptions
        {
            Enabled = enabled,
            BaseUrl = "https://musicbrainz.org",
            ApplicationName = "DiscWeave",
            ApplicationVersion = "1.0.0",
            Contact = "https://github.com/Fredoq/discweave",
            TimeoutSeconds = 15,
            OperationTimeoutSeconds = operationTimeoutSeconds,
            MinimumRequestIntervalMilliseconds = 1000,
            MaxRetries = maxRetries,
            MaxRetryAfterSeconds = 10,
            MaxRequestsPerOperation = maxRequestsPerOperation,
            MaxRecordingCandidates = maxRecordingCandidates,
            MaxLineageCandidates = 5,
            MaxReleasePagesPerRecording = maxReleasePages,
            MaxReleaseGroupLookups = maxReleaseGroupLookups
        };
    }

    private static string ReadFixture(string name, [CallerFilePath] string sourceFile = "")
    {
        string directory = Path.GetDirectoryName(sourceFile)!;
        return File.ReadAllText(Path.Combine(directory, "Fixtures", "MusicBrainz", name));
    }

    private static HttpResponseMessage JsonResponse(string content, HttpStatusCode statusCode = HttpStatusCode.OK)
    {
        return new HttpResponseMessage(statusCode)
        {
            Content = new StringContent(content, System.Text.Encoding.UTF8, "application/json")
        };
    }

    private sealed class ProviderHarness : IDisposable
    {
        private readonly HttpClient _httpClient;
        private readonly IDisposable? _ownedGate;
        private readonly MemoryCache? _memoryCache;
        private readonly ExternalMetadataRequestCache? _ownedCache;

        public ProviderHarness(
            CapturingHandler handler,
            MusicBrainzOptions options,
            TimeProvider? timeProvider = null,
            IMusicBrainzRequestGate? requestGate = null,
            IExternalMetadataRequestCache? requestCache = null)
        {
            Clock = timeProvider ?? TimeProvider.System;
            _httpClient = new HttpClient(handler)
            {
                BaseAddress = new Uri("https://musicbrainz.org/")
            };
            IMusicBrainzRequestGate gate = requestGate ?? new MusicBrainzRequestGate(Options.Create(options), Clock);
            _ownedGate = requestGate is null ? (IDisposable)gate : null;
            if (requestCache is null)
            {
                _memoryCache = new MemoryCache(new MemoryCacheOptions { SizeLimit = 128 });
                _ownedCache = new ExternalMetadataRequestCache(_memoryCache, Clock);
                requestCache = _ownedCache;
            }

            Provider = new MusicBrainzExternalMetadataProvider(
                _httpClient,
                Options.Create(options),
                gate,
                requestCache,
                Clock);
        }

        public MusicBrainzExternalMetadataProvider Provider { get; }

        public TimeProvider Clock { get; }

        public void Dispose()
        {
            _httpClient.Dispose();
            _ownedGate?.Dispose();
            _ownedCache?.Dispose();
            _memoryCache?.Dispose();
        }
    }

    private sealed class ImmediateRequestGate : IMusicBrainzRequestGate
    {
        public int WaitCount { get; private set; }

        public List<TimeSpan> Deferrals { get; } = [];

        public ValueTask WaitAsync(CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            WaitCount++;
            return ValueTask.CompletedTask;
        }

        public void Defer(TimeSpan retryAfter)
        {
            Deferrals.Add(retryAfter);
        }
    }

    private sealed class CapturingHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> _response;
        private readonly TaskCompletionSource _firstRequest = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int _callCount;

        public CapturingHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> response)
        {
            _response = response;
        }

        public List<HttpRequestMessage> Requests { get; } = [];

        public int CallCount => Volatile.Read(ref _callCount);

        public Task FirstRequest => _firstRequest.Task;

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            Requests.Add(request);
            _ = Interlocked.Increment(ref _callCount);
            _ = _firstRequest.TrySetResult();
            return _response(request, cancellationToken);
        }
    }
}
