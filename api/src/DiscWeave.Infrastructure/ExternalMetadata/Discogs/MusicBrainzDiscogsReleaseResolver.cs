using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using Microsoft.Extensions.Options;

namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public sealed partial class MusicBrainzDiscogsReleaseResolver
    : IExternalReleaseRouteResolver
{
    private readonly IExternalMetadataProviderResolver _providerResolver;
    private readonly DiscogsExternalMetadataProvider _discogsProvider;
    private readonly IExternalReleaseRouteMatcher _matcher;
    private readonly DiscogsOptions _options;

    public MusicBrainzDiscogsReleaseResolver(
        IExternalMetadataProviderResolver providerResolver,
        DiscogsExternalMetadataProvider discogsProvider,
        IExternalReleaseRouteMatcher matcher,
        IOptions<DiscogsOptions> options)
    {
        ArgumentNullException.ThrowIfNull(providerResolver);
        ArgumentNullException.ThrowIfNull(discogsProvider);
        ArgumentNullException.ThrowIfNull(matcher);
        ArgumentNullException.ThrowIfNull(options);

        _providerResolver = providerResolver;
        _discogsProvider = discogsProvider;
        _matcher = matcher;
        _options = options.Value;
    }

    public async Task<ExternalReleaseRouteBatchResolution> ResolveAsync(
        IReadOnlyList<ExternalReleaseRouteResolutionRequest> candidates,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(candidates);

        CandidateState[] states =
        [
            .. candidates.Select(candidate => new CandidateState(
                candidate.RecordingSource,
                candidate.MusicBrainzRoutes))
        ];
        RouteWork[] orderedWork = OrderWork(candidates);
        var discoveryBudget = DiscogsOriginalDiscoveryRequestBudget.Create(
            _options.MaxOriginalRequestsPerDiscovery);
        using var deadline =
            CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(
            TimeSpan.FromSeconds(_options.OriginalDiscoveryTimeoutSeconds));
        bool discoveryExhausted = false;
        int selectedCount = Math.Min(
            orderedWork.Length,
            _options.MaxOriginalRouteLookups);
        for (int index = 0; index < selectedCount; index++)
        {
            RouteWork work = orderedWork[index];
            CandidateState state = states[work.CandidateOrdinal];
            if (discoveryExhausted)
            {
                state.AddWarning("discogs.request_budget_exhausted");
                continue;
            }

            try
            {
                state.CurrentMusicBrainzRelease = null;
                discoveryExhausted = await ProcessInitialRouteAsync(
                    state,
                    work.Route,
                    discoveryBudget,
                    deadline.Token);
            }
            catch (OperationCanceledException)
                when (!cancellationToken.IsCancellationRequested)
            {
                state.AddWarning("discogs.timeout");
                state.AddFailure(TimeoutError());
                state.AddRetry(
                    work.Route,
                    state.CurrentMusicBrainzRelease);
                foreach (RouteWork remaining in orderedWork
                    .Skip(index + 1)
                    .Take(selectedCount - index - 1))
                {
                    states[remaining.CandidateOrdinal].AddWarning(
                        "discogs.lookup_skipped_after_timeout");
                }

                break;
            }
        }

        foreach (RouteWork work in orderedWork.Skip(selectedCount))
        {
            states[work.CandidateOrdinal].AddWarning(
                "discogs.lookup_limit_reached");
        }

        return CreateBatch(states);
    }

    public async Task<ExternalReleaseRouteBatchResolution> RetryAsync(
        DiscogsRouteRetryContext retryContext,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(retryContext);
        ValidateRetryContext(retryContext);

        var state = new CandidateState(
            retryContext.RecordingSource,
            [.. retryContext.Items.Select(item => item.Route)]);
        var discoveryBudget = DiscogsOriginalDiscoveryRequestBudget.Create(
            _options.MaxOriginalRequestsPerDiscovery);
        using var deadline =
            CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(
            TimeSpan.FromSeconds(_options.OriginalDiscoveryTimeoutSeconds));
        for (int index = 0; index < retryContext.Items.Count; index++)
        {
            DiscogsRouteRetryItem item = retryContext.Items[index];
            try
            {
                state.AttemptedRouteCount++;
                bool exhausted = await ProcessDiscogsRouteAsync(
                    state,
                    item.Route,
                    item.MusicBrainzRelease,
                    discoveryBudget,
                    deadline.Token);
                if (exhausted)
                {
                    AddRetryItems(
                        state,
                        retryContext.Items.Skip(index));
                    break;
                }
            }
            catch (OperationCanceledException)
                when (!cancellationToken.IsCancellationRequested)
            {
                state.AddWarning("discogs.timeout");
                state.AddFailure(TimeoutError());
                AddRetryItems(
                    state,
                    retryContext.Items.Skip(index));
                break;
            }
        }

        return CreateBatch([state]);
    }

    private static void AddRetryItems(
        CandidateState state,
        IEnumerable<DiscogsRouteRetryItem> items)
    {
        foreach (DiscogsRouteRetryItem item in items)
        {
            state.AddRetry(
                item.Route,
                item.MusicBrainzRelease);
        }
    }

    private static RouteWork[] OrderWork(
        IReadOnlyList<ExternalReleaseRouteResolutionRequest> candidates)
    {
        return
        [
            .. candidates
                .SelectMany((candidate, candidateOrdinal) =>
                    candidate.MusicBrainzRoutes.Select((route, routeOrdinal) =>
                        new RouteWork(
                            candidateOrdinal,
                            routeOrdinal,
                            route)))
                .OrderByDescending(work => HasDirectHint(work.Route))
                .ThenBy(work => DateCompleteness(work.Route.Date))
                .ThenBy(work => work.Route.Date?.Year ?? int.MaxValue)
                .ThenBy(work => work.Route.Date?.Month ?? int.MaxValue)
                .ThenBy(work => work.Route.Date?.Day ?? int.MaxValue)
                .ThenBy(work => work.CandidateOrdinal)
                .ThenBy(work => work.Route.ReleaseGroupSource.ExternalId, StringComparer.Ordinal)
                .ThenBy(work => work.Route.ReleaseSource.ExternalId, StringComparer.Ordinal)
                .ThenBy(work => work.RouteOrdinal)
        ];
    }

    private static int DateCompleteness(ProviderPartialDate? date)
    {
        return date is null
            ? 2
            : date.Month.HasValue && date.Day.HasValue
                ? 0
                : 1;
    }
}
