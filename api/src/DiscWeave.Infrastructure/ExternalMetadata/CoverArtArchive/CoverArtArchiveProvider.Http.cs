using System.Net;

namespace DiscWeave.Infrastructure.ExternalMetadata.CoverArtArchive;

public sealed partial class CoverArtArchiveProvider
{
    private async Task<byte[]> ReadBytesAsync(Uri uri, int limit, CancellationToken token)
    {
        for (int redirects = 0; redirects <= 4; redirects++)
        {
            CoverArtworkTransport.ValidateUri(uri);
            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            _ = request.Headers.UserAgent.TryParseAdd(MusicBrainz.MusicBrainzUserAgent.Build(_options));
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(token);
            Task<HttpResponseMessage> Send(CancellationToken cancellationToken)
            {
                cancellationToken.ThrowIfCancellationRequested();
                timeout.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(_options.TimeoutSeconds, 1, 30)));
                return _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
            }
            using HttpResponseMessage response = uri.Host.Equals("musicbrainz.org", StringComparison.OrdinalIgnoreCase)
                ? await _gate.SendAsync(Send, token).ConfigureAwait(false)
                : await Send(token).ConfigureAwait(false);
            if (IsRedirect(response.StatusCode))
            {
                uri = RedirectDestination(response, uri);
                continue;
            }
            ValidateStatus(response, uri);
            return await ReadBoundedBodyAsync(response.Content, limit, timeout.Token).ConfigureAwait(false);
        }
        throw Error("unsafe_redirect", "The artwork provider returned too many redirects");
    }

    private static bool IsRedirect(HttpStatusCode status)
    {
        return status is HttpStatusCode.MovedPermanently or HttpStatusCode.Redirect
            or HttpStatusCode.TemporaryRedirect or HttpStatusCode.PermanentRedirect or HttpStatusCode.SeeOther;
    }

    private static Uri RedirectDestination(HttpResponseMessage response, Uri current)
    {
        Uri location = response.Headers.Location ?? throw Error("unsafe_redirect", "The artwork provider returned an invalid redirect");
        Uri destination = location.IsAbsoluteUri ? location : new Uri(current, location);
        // Validate before following, including the final disallowed redirect.
        CoverArtworkTransport.ValidateUri(destination);
        return destination;
    }

    private void ValidateStatus(HttpResponseMessage response, Uri uri)
    {
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            throw Error("not_found", "No cover artwork is available for this edition");
        }
        if (response.StatusCode is HttpStatusCode.TooManyRequests or HttpStatusCode.ServiceUnavailable)
        {
            if (uri.Host.Equals("musicbrainz.org", StringComparison.OrdinalIgnoreCase))
            {
                TimeSpan delay = response.Headers.RetryAfter?.Delta
                    ?? (response.Headers.RetryAfter?.Date is DateTimeOffset date ? date - _time.GetUtcNow() : TimeSpan.FromSeconds(1));
                _gate.Defer(TimeSpan.FromSeconds(Math.Clamp(delay.TotalSeconds, 1, 60)));
            }
            throw Error("busy", "The artwork provider is busy; please try again later");
        }
        if (!response.IsSuccessStatusCode)
        {
            throw Error("unavailable", "The artwork provider is unavailable");
        }
    }

    private static async Task<byte[]> ReadBoundedBodyAsync(HttpContent content, int limit, CancellationToken token)
    {
        if (content.Headers.ContentLength > limit)
        {
            throw Error("too_large", "The artwork provider response exceeds the size limit");
        }
        await using Stream input = await content.ReadAsStreamAsync(token).ConfigureAwait(false);
        using var output = new MemoryStream();
        byte[] buffer = new byte[16 * 1024];
        int read;
        while ((read = await input.ReadAsync(buffer, token).ConfigureAwait(false)) > 0)
        {
            if (output.Length + read > limit)
            {
                throw Error("too_large", "The artwork provider response exceeds the size limit");
            }
            await output.WriteAsync(buffer.AsMemory(0, read), token).ConfigureAwait(false);
        }
        return output.ToArray();
    }
}
