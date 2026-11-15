using System.Net.Sockets;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Infrastructure.ExternalMetadata.CoverArtArchive;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace DiscWeave.Infrastructure.Tests;

public sealed class CoverArtArchiveProviderLoggingTests
{
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Transport_failure_logs_only_categories_and_preserves_safe_user_errors(bool nestedSocket)
    {
        const string secret = "https://private.example/search?query=secret-album&token=private-token";
        var socket = new SocketException((int)SocketError.HostNotFound);
        Exception inner = nestedSocket ? new IOException(secret, socket) : new InvalidOperationException(secret);
        var failure = new HttpRequestException(HttpRequestError.NameResolutionError, secret, inner);
        failure.Data["Authorization"] = secret;
        inner.Data["response"] = secret;
        using var handler = new FailingHandler(failure);
        using var client = new HttpClient(handler);
        IOptions<MusicBrainzOptions> options = Options.Create(new MusicBrainzOptions { Enabled = true });
        using var gate = new MusicBrainzRequestGate(options, TimeProvider.System);
        var logs = new CapturingLogger();
        var provider = new CoverArtArchiveProvider(client, options, gate, TimeProvider.System, logs);

        DomainException result = await Assert.ThrowsAsync<DomainException>(() =>
            provider.GetFrontCoversAsync(Guid.Parse("12345678-1234-1234-1234-123456789abc"), CancellationToken.None));

        Assert.Equal("external_cover.unavailable", result.Code);
        Assert.Equal("The artwork provider could not be reached", result.Message);
        Assert.Null(result.InnerException);
        Assert.Equal(LogLevel.Warning, logs.Level);
        Assert.Equal(1, logs.Count);
        Assert.Null(logs.Exception);
        Assert.Equal(HttpRequestError.NameResolutionError, logs.Fields["HttpRequestError"]);
        Assert.Equal(inner.GetType().Name, logs.Fields["InnerExceptionType"]);
        Assert.Equal(nestedSocket ? "HostNotFound" : "None", logs.Fields["SocketErrorCode"]);
        Assert.Equal(
            ["HttpRequestError", "InnerExceptionType", "SocketErrorCode", "{OriginalFormat}"],
            logs.Fields.Keys.Order(StringComparer.Ordinal));
        Assert.DoesNotContain(secret, logs.Text, StringComparison.Ordinal);
        Assert.DoesNotContain("query=", logs.Text, StringComparison.Ordinal);
        Assert.DoesNotContain("private-token", string.Join(" ", logs.Fields.Values), StringComparison.Ordinal);
        Assert.DoesNotContain("Authorization", string.Join(" ", logs.Fields.Keys), StringComparison.Ordinal);
    }

    private sealed class FailingHandler : HttpMessageHandler
    {
        private readonly HttpRequestException _failure;

        public FailingHandler(HttpRequestException failure)
        {
            _failure = failure;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromException<HttpResponseMessage>(_failure);
        }
    }

    private sealed class CapturingLogger : ILogger<CoverArtArchiveProvider>
    {
        public int Count { get; private set; }
        public LogLevel Level { get; private set; }
        public Exception? Exception { get; private set; }
        public string Text { get; private set; } = "";
        public Dictionary<string, object?> Fields { get; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull
        {
            return null;
        }

        public bool IsEnabled(LogLevel logLevel)
        {
            return true;
        }

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            Count++;
            Level = logLevel;
            Exception = exception;
            Text = formatter(state, exception);
            foreach (KeyValuePair<string, object?> field in (IEnumerable<KeyValuePair<string, object?>>)state!)
            {
                Fields.Add(field.Key, field.Value);
            }
        }
    }
}
