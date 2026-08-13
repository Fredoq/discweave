using System.Net;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace DiscWeave.Infrastructure.Tests;

public sealed class MusicBrainzProviderLoggingTests
{
    [Fact]
    public async Task Typed_client_logs_only_safe_structured_operation_metadata()
    {
        const string privateTitle = "Private title that must not enter logs";
        const string privateArtist = "Private artist that must not enter logs";
        const string privateContact = "private-contact@example.test";
        const string rawResponseValue = "raw response content that must not enter logs";
        CapturingLoggerProvider logs = new();
        var handler = new StaticResponseHandler(
            // lang=json
            $$"""
            {
              "count": 0,
              "offset": 0,
              "recordings": [],
              "private": "{{rawResponseValue}}"
            }
            """);
        IConfiguration configuration = ValidConfiguration(privateContact);
        ServiceCollection services = new();
        _ = services.AddSingleton(configuration);
        _ = services.AddLogging(builder =>
        {
            _ = builder.SetMinimumLevel(LogLevel.Information);
            _ = builder.AddProvider(logs);
        });
        _ = services.AddDiscWeaveInfrastructure(configuration);
        _ = services.AddHttpClient<MusicBrainzExternalMetadataProvider>()
            .ConfigurePrimaryHttpMessageHandler(() => handler);
        await using ServiceProvider root = services.BuildServiceProvider(validateScopes: true);
        await using AsyncServiceScope scope = root.CreateAsyncScope();
        MusicBrainzExternalMetadataProvider provider =
            scope.ServiceProvider.GetRequiredService<MusicBrainzExternalMetadataProvider>();

        _ = await provider.SearchRecordingsAsync(
            privateTitle,
            [privateArtist],
            CancellationToken.None);

        Assert.DoesNotContain(privateTitle, logs.Text, StringComparison.Ordinal);
        Assert.DoesNotContain(privateArtist, logs.Text, StringComparison.Ordinal);
        Assert.DoesNotContain(privateContact, logs.Text, StringComparison.Ordinal);
        Assert.DoesNotContain(rawResponseValue, logs.Text, StringComparison.Ordinal);
        Assert.DoesNotContain("query=", logs.Text, StringComparison.OrdinalIgnoreCase);
        CapturedLog operation = Assert.Single(
            logs.Entries,
            entry => entry.Category == typeof(MusicBrainzExternalMetadataProvider).FullName);
        Assert.Equal(
            ["DurationMilliseconds", "Operation", "ProviderCode", "ResultCount", "Status", "{OriginalFormat}"],
            operation.Fields.Keys.Order(StringComparer.Ordinal));
        Assert.Equal("musicbrainz", operation.Fields["ProviderCode"]);
        Assert.Equal("recording-search", operation.Fields["Operation"]);
        Assert.Equal("success", operation.Fields["Status"]);
        Assert.Equal(0, operation.Fields["ResultCount"]);
    }

    private static IConfiguration ValidConfiguration(string contact)
    {
        Dictionary<string, string?> values = new(StringComparer.Ordinal)
        {
            ["ConnectionStrings:DiscWeave"] = "Data Source=:memory:",
            ["DiscWeave:StorageProvider"] = "Sqlite",
            ["Discogs:UserAgent"] = "DiscWeave.Tests/1.0",
            ["Discogs:BaseUrl"] = "https://api.discogs.test",
            ["Discogs:TimeoutSeconds"] = "10",
            ["MusicBrainz:Enabled"] = "true",
            ["MusicBrainz:BaseUrl"] = "https://musicbrainz.test",
            ["MusicBrainz:ApplicationName"] = "DiscWeave",
            ["MusicBrainz:ApplicationVersion"] = "1.0.0",
            ["MusicBrainz:Contact"] = contact,
            ["MusicBrainz:TimeoutSeconds"] = "15",
            ["MusicBrainz:OperationTimeoutSeconds"] = "60",
            ["MusicBrainz:MinimumRequestIntervalMilliseconds"] = "1000",
            ["MusicBrainz:MaxRetries"] = "2",
            ["MusicBrainz:MaxRetryAfterSeconds"] = "10",
            ["MusicBrainz:MaxRequestsPerOperation"] = "40",
            ["MusicBrainz:MaxRecordingCandidates"] = "5",
            ["MusicBrainz:MaxLineageCandidates"] = "5",
            ["MusicBrainz:MaxReleasePagesPerRecording"] = "5",
            ["MusicBrainz:MaxReleaseGroupLookups"] = "10"
        };
        return new ConfigurationBuilder().AddInMemoryCollection(values).Build();
    }

    private sealed class StaticResponseHandler : HttpMessageHandler
    {
        private readonly string _content;

        public StaticResponseHandler(string content)
        {
            _content = content;
        }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(_content)
            });
        }
    }

    private sealed class CapturingLoggerProvider : ILoggerProvider
    {
        private readonly List<CapturedLog> _entries = [];

        public IReadOnlyList<CapturedLog> Entries => _entries;

        public string Text => string.Join(
            Environment.NewLine,
            _entries.Select(entry =>
                string.Join(
                    " ",
                    entry.Message,
                    string.Join(
                        " ",
                        entry.Fields.Select(item => $"{item.Key}={item.Value}")))));

        public ILogger CreateLogger(string categoryName)
        {
            return new CapturingLogger(categoryName, _entries);
        }

        public void Dispose()
        {
        }
    }

    private sealed class CapturingLogger : ILogger
    {
        private readonly string _category;
        private readonly List<CapturedLog> _entries;

        public CapturingLogger(string category, List<CapturedLog> entries)
        {
            _category = category;
            _entries = entries;
        }

        public IDisposable? BeginScope<TState>(TState state)
            where TState : notnull
        {
            return null;
        }

        public bool IsEnabled(LogLevel logLevel)
        {
            return true;
        }

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            Dictionary<string, object?> fields = state is IEnumerable<KeyValuePair<string, object?>> values
                ? values.ToDictionary(item => item.Key, item => item.Value, StringComparer.Ordinal)
                : new Dictionary<string, object?>(StringComparer.Ordinal);
            _entries.Add(new CapturedLog(_category, formatter(state, exception), fields));
        }
    }

    private sealed class CapturedLog
    {
        public CapturedLog(
            string category,
            string message,
            IReadOnlyDictionary<string, object?> fields)
        {
            Category = category;
            Message = message;
            Fields = fields;
        }

        public string Category { get; }

        public string Message { get; }

        public IReadOnlyDictionary<string, object?> Fields { get; }
    }
}
