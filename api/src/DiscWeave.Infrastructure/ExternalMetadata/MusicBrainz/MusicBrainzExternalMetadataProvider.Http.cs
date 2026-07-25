using System.Globalization;
using System.Text.Json;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private async Task<ExternalMetadataResult<T>> SendAsync<T>(
        string path,
        MusicBrainzOperationContext context)
        where T : class
    {
        for (int retry = 0; ; retry++)
        {
            if (!context.TryReserveAttempt())
            {
                return new ExternalMetadataResult<T>(OperationBudgetExhausted());
            }

            using HttpRequestMessage request = CreateRequest(path);
            try
            {
                await _requestGate.WaitAsync(context.DeadlineToken).ConfigureAwait(false);
                using HttpResponseMessage response = await _httpClient.SendAsync(
                    request,
                    HttpCompletionOption.ResponseHeadersRead,
                    context.DeadlineToken).ConfigureAwait(false);

                ExternalMetadataResult<T>? completed = await TryMapResponseAsync<T>(
                    response,
                    retry,
                    context).ConfigureAwait(false);
                if (completed is not null)
                {
                    return completed;
                }
            }
            catch (OperationCanceledException)
            {
                return new ExternalMetadataResult<T>(Timeout());
            }
            catch (JsonException)
            {
                return new ExternalMetadataResult<T>(InvalidResponse());
            }
            catch (HttpRequestException) when (retry < _options.MaxRetries)
            {
                ExternalMetadataError? delayError = await DelayForRetryAsync(retry, context)
                    .ConfigureAwait(false);
                if (delayError is not null)
                {
                    return new ExternalMetadataResult<T>(delayError);
                }
            }
            catch (HttpRequestException)
            {
                return new ExternalMetadataResult<T>(Unavailable());
            }
        }
    }

    private async Task<ExternalMetadataResult<T>?> TryMapResponseAsync<T>(
        HttpResponseMessage response,
        int retry,
        MusicBrainzOperationContext context)
        where T : class
    {
        if (response.IsSuccessStatusCode)
        {
            return await ReadSuccessAsync<T>(response, context.DeadlineToken).ConfigureAwait(false);
        }

        ExternalMetadataError error = MapFailure(response, _timeProvider);
        if (!IsRetryableStatus(response.StatusCode))
        {
            return new ExternalMetadataResult<T>(error);
        }

        if (IsRateLimitedStatus(response.StatusCode) &&
            error.RetryAfter is TimeSpan retryAfter)
        {
            if (retryAfter > TimeSpan.FromSeconds(_options.MaxRetryAfterSeconds))
            {
                return new ExternalMetadataResult<T>(error);
            }

            _requestGate.Defer(retryAfter);
        }

        if (retry >= _options.MaxRetries)
        {
            return new ExternalMetadataResult<T>(error);
        }

        if (!IsRateLimitedStatus(response.StatusCode) || error.RetryAfter is null)
        {
            ExternalMetadataError? delayError = await DelayForRetryAsync(retry, context)
                .ConfigureAwait(false);
            if (delayError is not null)
            {
                return new ExternalMetadataResult<T>(delayError);
            }
        }

        return null;
    }

    private static async Task<ExternalMetadataResult<T>> ReadSuccessAsync<T>(
        HttpResponseMessage response,
        CancellationToken cancellationToken)
        where T : class
    {
        await using Stream stream = await response.Content
            .ReadAsStreamAsync(cancellationToken)
            .ConfigureAwait(false);
        T? value = await JsonSerializer.DeserializeAsync<T>(
            stream,
            JsonOptions,
            cancellationToken).ConfigureAwait(false);

        return value is null
            ? new ExternalMetadataResult<T>(InvalidResponse())
            : new ExternalMetadataResult<T>(value);
    }

    private async Task<ExternalMetadataError?> DelayForRetryAsync(
        int retry,
        MusicBrainzOperationContext context)
    {
        var delay = TimeSpan.FromSeconds(Math.Min(retry + 1, 2));
        try
        {
            await Task.Delay(delay, _timeProvider, context.DeadlineToken).ConfigureAwait(false);
            return null;
        }
        catch (OperationCanceledException)
        {
            return Timeout();
        }
    }

    private HttpRequestMessage CreateRequest(string path)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, new Uri(path, UriKind.Relative));
        request.Headers.UserAgent.Clear();
        string userAgent = $"{_options.ApplicationName}/{_options.ApplicationVersion} ({_options.Contact})";
        if (!request.Headers.UserAgent.TryParseAdd(userAgent))
        {
            request.Dispose();
            throw new InvalidOperationException("MusicBrainz User-Agent configuration is invalid.");
        }

        return request;
    }

    private static string RecordingSearchPath(string query, int limit)
    {
        return $"/ws/2/recording?query={Uri.EscapeDataString(query)}" +
            $"&limit={limit.ToString(CultureInfo.InvariantCulture)}&offset=0&fmt=json";
    }

    private static string RecordingDetailPath(string mbid)
    {
        return $"/ws/2/recording/{mbid}" +
            "?inc=artist-credits+recording-rels+work-rels&fmt=json";
    }

    private static string ReleaseBrowsePath(string mbid, int offset)
    {
        return $"/ws/2/release?recording={mbid}&limit=100" +
            $"&offset={offset.ToString(CultureInfo.InvariantCulture)}" +
            "&inc=artist-credits+labels+recordings+release-groups+media+url-rels&fmt=json";
    }

    private static string ReleaseDetailPath(string mbid)
    {
        return $"/ws/2/release/{mbid}" +
            "?inc=artist-credits+labels+recordings+release-groups+media+url-rels&fmt=json";
    }

    private static string ReleaseGroupDetailPath(string mbid)
    {
        return $"/ws/2/release-group/{mbid}?inc=release-group-rels&fmt=json";
    }
}
