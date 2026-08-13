using System.Net;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    private const string OperationBudgetExhaustedCode = "musicbrainz.operation_budget_exhausted";

    private static ExternalMetadataError MapFailure(
        HttpResponseMessage response,
        TimeProvider timeProvider)
    {
        return response.StatusCode == HttpStatusCode.NotFound // NOSONAR: HTTP status mapping is ordered by provider semantics.
            ? NotFound()
            : IsRateLimitedStatus(response.StatusCode) // NOSONAR: HTTP status mapping is ordered by provider semantics.
            ? RateLimited(RetryAfter(response, timeProvider))
            : response.StatusCode is // NOSONAR: HTTP status mapping is ordered by provider semantics.
            HttpStatusCode.InternalServerError or
            HttpStatusCode.BadGateway or
            HttpStatusCode.GatewayTimeout
            ? Unavailable()
            : InvalidResponse();
    }

    private static bool IsRetryableStatus(HttpStatusCode statusCode)
    {
        return statusCode is
            HttpStatusCode.TooManyRequests or
            HttpStatusCode.ServiceUnavailable or
            HttpStatusCode.InternalServerError or
            HttpStatusCode.BadGateway or
            HttpStatusCode.GatewayTimeout;
    }

    private static bool IsRateLimitedStatus(HttpStatusCode statusCode)
    {
        return statusCode is HttpStatusCode.TooManyRequests or HttpStatusCode.ServiceUnavailable;
    }

    private static TimeSpan? RetryAfter(HttpResponseMessage response, TimeProvider timeProvider)
    {
        if (response.Headers.RetryAfter?.Delta is TimeSpan delta)
        {
            return delta < TimeSpan.Zero ? TimeSpan.Zero : delta;
        }

        if (response.Headers.RetryAfter?.Date is not DateTimeOffset retryAt)
        {
            return null;
        }

        TimeSpan delay = retryAt - timeProvider.GetUtcNow();
        return delay < TimeSpan.Zero ? TimeSpan.Zero : delay;
    }

    private static ExternalMetadataError Disabled()
    {
        return new ExternalMetadataError(
            ExternalMetadataErrorKind.Disabled,
            "external_metadata.disabled",
            "External metadata provider is disabled");
    }

    private static ExternalMetadataError NotFound()
    {
        return new ExternalMetadataError(
            ExternalMetadataErrorKind.NotFound,
            "external_metadata.not_found",
            "External metadata resource was not found");
    }

    private static ExternalMetadataError RateLimited(TimeSpan? retryAfter)
    {
        return new ExternalMetadataError(
            ExternalMetadataErrorKind.RateLimited,
            "external_metadata.rate_limited",
            "External metadata provider rate limit was exceeded",
            retryAfter);
    }

    private static ExternalMetadataError Timeout()
    {
        return new ExternalMetadataError(
            ExternalMetadataErrorKind.Timeout,
            "external_metadata.timeout",
            "External metadata provider timed out");
    }

    private static ExternalMetadataError Unavailable()
    {
        return new ExternalMetadataError(
            ExternalMetadataErrorKind.Unavailable,
            "external_metadata.unavailable",
            "External metadata provider is unavailable");
    }

    private static ExternalMetadataError InvalidResponse()
    {
        return new ExternalMetadataError(
            ExternalMetadataErrorKind.InvalidResponse,
            "external_metadata.invalid_response",
            "External metadata provider returned an invalid response");
    }

    private static ExternalMetadataError UnsupportedCapability()
    {
        return new ExternalMetadataError(
            ExternalMetadataErrorKind.UnsupportedCapability,
            "external_metadata.unsupported_capability",
            "External metadata provider does not support this capability");
    }

    private static ExternalMetadataError OperationBudgetExhausted()
    {
        return new ExternalMetadataError(
            ExternalMetadataErrorKind.Unavailable,
            OperationBudgetExhaustedCode,
            "MusicBrainz operation request budget was exhausted");
    }
}
