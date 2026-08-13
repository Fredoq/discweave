using System.Net;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace DiscWeave.Infrastructure.Tests;

public sealed class DiscogsProviderLoggingTests
{
    [Fact]
    public async Task Named_client_does_not_log_private_search_query_fields()
    {
        const string privateArtist = "PrivateArtistToken";
        const string privateTitle = "PrivateReleaseTitleToken";
        const string privateBarcode = "9876543210123";
        const string privateCatalog = "PrivateCatalogToken";
        const int privateYear = 2077;
        var logs = new LogCaptureProvider();
        var handler = new SearchResponseHandler();
        IConfiguration configuration = ValidConfiguration();
        ServiceCollection services = new();
        _ = services.AddSingleton(configuration);
        _ = services.AddLogging(builder =>
        {
            _ = builder.SetMinimumLevel(LogLevel.Information);
            _ = builder.AddProvider(logs);
        });
        _ = services.AddDiscWeaveInfrastructure(configuration);
        _ = services.AddSingleton<IDiscogsAccessTokenProvider>(
            new FixedDiscogsAccessTokenProvider("test-token"));
        _ = services.AddHttpClient("Discogs")
            .ConfigurePrimaryHttpMessageHandler(() => handler);
        await using ServiceProvider root =
            services.BuildServiceProvider(validateScopes: true);
        await using AsyncServiceScope scope = root.CreateAsyncScope();
        DiscogsExternalMetadataProvider provider = scope.ServiceProvider
            .GetRequiredService<DiscogsExternalMetadataProvider>();
        DiscogsOriginalRouteRequestBudget budget =
            DiscogsOriginalDiscoveryRequestBudget.Create(1)
                .CreateRouteBudget(1);

        ExternalMetadataResult<
            ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>> result =
            await provider.SearchReleasesAsync(
                new ExternalMetadataReleaseSearchQuery(
                    Artist: privateArtist,
                    Title: privateTitle,
                    Year: privateYear,
                    Barcode: privateBarcode,
                    CatalogNumber: privateCatalog,
                    Limit: 3),
                budget,
                CancellationToken.None);

        Assert.True(result.IsSuccess);
        Uri requestUri = Assert.IsType<Uri>(handler.RequestUri);
        Assert.Contains(privateArtist, requestUri.AbsoluteUri, StringComparison.Ordinal);
        Assert.Contains(privateTitle, requestUri.AbsoluteUri, StringComparison.Ordinal);
        Assert.Contains(privateBarcode, requestUri.AbsoluteUri, StringComparison.Ordinal);
        Assert.Contains(privateCatalog, requestUri.AbsoluteUri, StringComparison.Ordinal);
        Assert.Contains("year=2077", requestUri.Query, StringComparison.Ordinal);
        Assert.DoesNotContain(privateArtist, logs.Text, StringComparison.Ordinal);
        Assert.DoesNotContain(privateTitle, logs.Text, StringComparison.Ordinal);
        Assert.DoesNotContain(privateBarcode, logs.Text, StringComparison.Ordinal);
        Assert.DoesNotContain(privateCatalog, logs.Text, StringComparison.Ordinal);
        Assert.DoesNotContain("year=2077", logs.Text, StringComparison.Ordinal);
        Assert.DoesNotContain(requestUri.AbsoluteUri, logs.Text, StringComparison.Ordinal);
        Assert.DoesNotContain(
            logs.Entries,
            entry => entry.StartsWith(
                "System.Net.Http.HttpClient.Discogs.",
                StringComparison.Ordinal));
    }

    private static IConfiguration ValidConfiguration()
    {
        Dictionary<string, string?> values = new(StringComparer.Ordinal)
        {
            ["ConnectionStrings:DiscWeave"] = "Data Source=:memory:",
            ["DiscWeave:StorageProvider"] = "Sqlite",
            ["Discogs:UserAgent"] = "DiscWeave.Tests/1.0",
            ["Discogs:BaseUrl"] = "https://api.discogs.test",
            ["Discogs:TimeoutSeconds"] = "10"
        };
        return new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();
    }

    private sealed class SearchResponseHandler : HttpMessageHandler
    {
        public Uri? RequestUri { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            RequestUri = request.RequestUri;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    /*lang=json,strict*/
                    """{"pagination":{"items":0},"results":[]}""")
            });
        }
    }

    private sealed class LogCaptureProvider : ILoggerProvider
    {
        private readonly List<string> _entries = [];

        public IReadOnlyList<string> Entries => _entries;

        public string Text => string.Join(Environment.NewLine, _entries);

        public ILogger CreateLogger(string categoryName)
        {
            return new LogCapture(categoryName, _entries);
        }

        public void Dispose()
        {
        }
    }

    private sealed class LogCapture : ILogger
    {
        private readonly string _category;
        private readonly List<string> _entries;

        public LogCapture(string category, List<string> entries)
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
            string fields = state is
                IEnumerable<KeyValuePair<string, object?>> values
                    ? string.Join(
                        " ",
                        values.Select(value =>
                            $"{value.Key}={value.Value}"))
                    : string.Empty;
            _entries.Add(
                $"{_category} {formatter(state, exception)} {fields}");
        }
    }
}
