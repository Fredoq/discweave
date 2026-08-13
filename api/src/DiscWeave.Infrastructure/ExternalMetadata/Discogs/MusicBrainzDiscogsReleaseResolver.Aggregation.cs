using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public sealed partial class MusicBrainzDiscogsReleaseResolver
{
    private static ExternalReleaseRouteBatchResolution CreateBatch(
        IReadOnlyList<CandidateState> states)
    {
        foreach (CandidateState state in states)
        {
            FinalizePreference(state);
        }

        ExternalReleaseCandidateRouteResolution[] candidates =
        [
            .. states.Select(state =>
                new ExternalReleaseCandidateRouteResolution
                {
                    RecordingSource = state.RecordingSource,
                    Routes = state.Routes,
                    DiscogsStatus = Status(
                        state.AnyDiscogsSuccess,
                        state.Failures),
                    Warnings = [.. state.Warnings],
                    RetryContext = new DiscogsRouteRetryContext
                    {
                        RecordingSource = state.RecordingSource,
                        Items = state.RetryItems
                    },
                    AttemptedDiscogsRouteCount =
                        state.AttemptedRouteCount,
                    OutboundRequestCount =
                        state.OutboundRequestCount
                })
        ];
        ExternalMetadataError[] allFailures =
            [.. states.SelectMany(state => state.Failures)];
        var warnings = new SortedSet<string>(
            states.SelectMany(state => state.Warnings),
            StringComparer.Ordinal);
        return new ExternalReleaseRouteBatchResolution
        {
            Candidates = candidates,
            DiscogsStatus = Status(
                states.Any(state => state.AnyDiscogsSuccess),
                allFailures),
            AttemptedDiscogsRouteCount = checked(
                states.Sum(state => state.AttemptedRouteCount)),
            OutboundRequestCount = checked(
                states.Sum(state => state.OutboundRequestCount)),
            Warnings = [.. warnings]
        };
    }

    private static void FinalizePreference(CandidateState state)
    {
        int[] bindingIndexes =
        [
            .. state.Routes
                .Select((route, index) => new { Route = route, Index = index })
                .Where(value => value.Route.DiscogsBinding is not null)
                .Select(value => value.Index)
        ];
        if (bindingIndexes.Length == 1)
        {
            int index = bindingIndexes[0];
            state.Routes[index] = state.Routes[index] with
            {
                IsPreferred = true
            };
        }
    }

    private static ExternalProviderOperationStatus Status(
        bool anySuccess,
        IReadOnlyList<ExternalMetadataError> failures)
    {
        if (anySuccess || failures.Count == 0)
        {
            return new ExternalProviderOperationStatus
            {
                ProviderCode = "discogs",
                Outcome = ExternalProviderOperationOutcome.Succeeded
            };
        }

        ExternalMetadataError selected = failures
            .OrderBy(error => FailurePrecedence(error.Kind))
            .ThenByDescending(error => error.RetryAfter)
            .First();
        return new ExternalProviderOperationStatus
        {
            ProviderCode = "discogs",
            Outcome = ToOutcome(selected.Kind),
            ErrorCode = selected.Code,
            RetryAfter = selected.Kind == ExternalMetadataErrorKind.RateLimited
                ? failures
                    .Where(error =>
                        error.Kind ==
                            ExternalMetadataErrorKind.RateLimited)
                    .Max(error => error.RetryAfter)
                : selected.RetryAfter
        };
    }

    private static int FailurePrecedence(ExternalMetadataErrorKind kind)
    {
        return kind switch
        {
            ExternalMetadataErrorKind.Unauthorized => 0,
            ExternalMetadataErrorKind.NotConfigured => 1,
            ExternalMetadataErrorKind.Disabled => 2,
            ExternalMetadataErrorKind.RateLimited => 3,
            ExternalMetadataErrorKind.Timeout => 4,
            ExternalMetadataErrorKind.Unavailable => 5,
            ExternalMetadataErrorKind.InvalidResponse => 6,
            ExternalMetadataErrorKind.NotFound => 7,
            ExternalMetadataErrorKind.UnknownProvider => 8,
            ExternalMetadataErrorKind.UnsupportedCapability => 9,
            _ => throw new ArgumentOutOfRangeException(
                nameof(kind),
                kind,
                "Unknown external metadata error kind")
        };
    }

    private static ExternalProviderOperationOutcome ToOutcome(
        ExternalMetadataErrorKind kind)
    {
        return kind switch
        {
            ExternalMetadataErrorKind.Unauthorized =>
                ExternalProviderOperationOutcome.Unauthorized,
            ExternalMetadataErrorKind.NotConfigured =>
                ExternalProviderOperationOutcome.NotConfigured,
            ExternalMetadataErrorKind.Disabled =>
                ExternalProviderOperationOutcome.Disabled,
            ExternalMetadataErrorKind.RateLimited =>
                ExternalProviderOperationOutcome.RateLimited,
            ExternalMetadataErrorKind.Timeout =>
                ExternalProviderOperationOutcome.Timeout,
            ExternalMetadataErrorKind.Unavailable =>
                ExternalProviderOperationOutcome.Unavailable,
            ExternalMetadataErrorKind.InvalidResponse =>
                ExternalProviderOperationOutcome.InvalidResponse,
            ExternalMetadataErrorKind.NotFound =>
                ExternalProviderOperationOutcome.NotFound,
            ExternalMetadataErrorKind.UnknownProvider =>
                ExternalProviderOperationOutcome.UnknownProvider,
            ExternalMetadataErrorKind.UnsupportedCapability =>
                ExternalProviderOperationOutcome.UnsupportedCapability,
            _ => throw new ArgumentOutOfRangeException(
                nameof(kind),
                kind,
                "Unknown external metadata error kind")
        };
    }

    private static string WarningCode(ExternalMetadataError error)
    {
        return error.Code.StartsWith(
            "discogs.",
            StringComparison.Ordinal)
            ? error.Code
            : WarningCode(error.Kind);
    }

    private static string WarningCode(ExternalMetadataErrorKind kind)
    {
        return kind switch
        {
            ExternalMetadataErrorKind.Unauthorized =>
                "discogs.unauthorized",
            ExternalMetadataErrorKind.NotConfigured =>
                "discogs.not_configured",
            ExternalMetadataErrorKind.Disabled =>
                "discogs.disabled",
            ExternalMetadataErrorKind.RateLimited =>
                "discogs.rate_limited",
            ExternalMetadataErrorKind.Timeout =>
                "discogs.timeout",
            ExternalMetadataErrorKind.Unavailable =>
                "discogs.unavailable",
            ExternalMetadataErrorKind.InvalidResponse =>
                "discogs.invalid_response",
            ExternalMetadataErrorKind.NotFound =>
                "discogs.not_found",
            ExternalMetadataErrorKind.UnknownProvider =>
                "discogs.unavailable",
            ExternalMetadataErrorKind.UnsupportedCapability =>
                "discogs.unavailable",
            _ => throw new ArgumentOutOfRangeException(
                nameof(kind),
                kind,
                "Unknown external metadata error kind")
        };
    }

    private static ExternalMetadataError TimeoutError()
    {
        return new ExternalMetadataError(
            ExternalMetadataErrorKind.Timeout,
            "discogs.timeout",
            "Discogs route discovery timed out");
    }
}
