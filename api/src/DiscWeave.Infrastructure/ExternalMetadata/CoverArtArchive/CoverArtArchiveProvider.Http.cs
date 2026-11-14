using System.Net;

namespace DiscWeave.Infrastructure.ExternalMetadata.CoverArtArchive;

public sealed partial class CoverArtArchiveProvider
{
    private async Task<byte[]> ReadBytesAsync(Uri uri, int limit, CancellationToken token)
    {
        for (int redirects = 0; redirects <= 4; redirects++)
        {
            CoverArtworkTransport.ValidateUri(uri);
            if (uri.Host.Equals("musicbrainz.org", StringComparison.OrdinalIgnoreCase))
            {
                await _gate.WaitAsync(token).ConfigureAwait(false);
            }
            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            _ = request.Headers.UserAgent.TryParseAdd(MusicBrainz.MusicBrainzUserAgent.Build(_options));
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(token);
            timeout.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(_options.TimeoutSeconds, 1, 30)));
            using HttpResponseMessage response = await _client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token).ConfigureAwait(false);
            if (response.StatusCode is HttpStatusCode.MovedPermanently or HttpStatusCode.Redirect or HttpStatusCode.TemporaryRedirect or HttpStatusCode.PermanentRedirect or HttpStatusCode.SeeOther)
            {
                Uri location = response.Headers.Location ?? throw Error("unsafe_redirect", "The artwork provider returned an invalid redirect");
                uri = location.IsAbsoluteUri ? location : new Uri(uri, location);
                // Validate before following, including the final disallowed redirect.
                CoverArtworkTransport.ValidateUri(uri);
                continue;
            }
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
            if (response.Content.Headers.ContentLength > limit)
            {
                throw Error("too_large", "The artwork provider response exceeds the size limit");
            }
            await using Stream input = await response.Content.ReadAsStreamAsync(timeout.Token).ConfigureAwait(false);
            using var output = new MemoryStream();
            byte[] buffer = new byte[16 * 1024];
            int read;
            while ((read = await input.ReadAsync(buffer, timeout.Token).ConfigureAwait(false)) > 0)
            {
                if (output.Length + read > limit)
                {
                    throw Error("too_large", "The artwork provider response exceeds the size limit");
                }
                output.Write(buffer, 0, read);
            }
            return output.ToArray();
        }
        throw Error("unsafe_redirect", "The artwork provider returned too many redirects");
    }
}
