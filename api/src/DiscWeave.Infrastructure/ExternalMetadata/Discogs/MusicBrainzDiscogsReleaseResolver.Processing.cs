using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public sealed partial class MusicBrainzDiscogsReleaseResolver
{
    private async Task<bool> ProcessInitialRouteAsync(
        CandidateState state,
        RecordingReleaseRoute route,
        DiscogsOriginalDiscoveryRequestBudget discoveryBudget,
        CancellationToken cancellationToken)
    {
        state.AttemptedRouteCount++;
        if (!IsActionableRoute(state.RecordingSource, route))
        {
            state.AddWarning("musicbrainz.release_route_invalid");
            return false;
        }

        ExternalMetadataResult<IExternalMetadataProvider> providerResult =
            _providerResolver.Resolve("musicbrainz");
        if (!providerResult.IsSuccess)
        {
            state.AddWarning("musicbrainz.release_detail_unavailable");
            return false;
        }

        ExternalMetadataResult<ExternalMetadataReleaseDetail> releaseResult =
            await providerResult.Value.GetReleaseAsync(
                new ExternalMetadataLookupQuery(
                    route.ReleaseSource.ExternalId),
                cancellationToken);
        if (!releaseResult.IsSuccess)
        {
            state.AddWarning("musicbrainz.release_detail_unavailable");
            return false;
        }

        state.CurrentMusicBrainzRelease = releaseResult.Value;
        return await ProcessDiscogsRouteAsync(
            state,
            route,
            releaseResult.Value,
            discoveryBudget,
            cancellationToken);
    }

    private async Task<bool> ProcessDiscogsRouteAsync( // NOSONAR: route processing intentionally handles provider outcomes and fallbacks.
        CandidateState state,
        RecordingReleaseRoute route,
        ExternalMetadataReleaseDetail musicBrainzRelease,
        DiscogsOriginalDiscoveryRequestBudget discoveryBudget,
        CancellationToken cancellationToken)
    {
        DiscogsOriginalRouteRequestBudget routeBudget =
            discoveryBudget.CreateRouteBudget(
                _options.MaxOriginalRequestsPerRoute);
        var matches = new List<ExternalReleaseRouteMatchResult>();
        bool providerFailure = false;
        try
        {
            ExternalMetadataSource? directSource =
                AuthoritativeDirectSource(route, musicBrainzRelease);
            if (directSource is not null)
            {
                ExternalMetadataResult<ExternalMetadataReleaseDetail> direct =
                    await _discogsProvider.GetReleaseAsync(
                        new ExternalMetadataLookupQuery(
                            directSource.ExternalId),
                        routeBudget,
                        cancellationToken);
                if (direct.IsSuccess)
                {
                    state.AnyDiscogsSuccess = true;
                    matches.Add(_matcher.Match(
                        MatchInput(
                            state,
                            route,
                            musicBrainzRelease,
                            direct.Value,
                            ExternalReleaseRouteMatchAuthority.DirectRelationship)));
                }
                else
                {
                    state.AddFailure(direct.Error);
                    state.AddRetry(route, musicBrainzRelease);
                    return IsDiscoveryExhausted(direct.Error);
                }
            }

            if (matches.Any(match =>
                match.Outcome is ExternalReleaseRouteMatchOutcome.Matched
                    or ExternalReleaseRouteMatchOutcome.AmbiguousRows))
            {
                AddBindings(state, route, matches);
                return false;
            }

            ExternalMetadataResult<
                ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>>
                search;
            ExternalMetadataReleaseSearchQuery searchQuery =
                SearchQuery(musicBrainzRelease);
            search =
                await _discogsProvider.SearchReleasesAsync(
                    searchQuery,
                    routeBudget,
                    cancellationToken);
            if (!search.IsSuccess)
            {
                state.AddFailure(search.Error);
                state.AddRetry(route, musicBrainzRelease);
                return IsDiscoveryExhausted(search.Error);
            }

            state.AnyDiscogsSuccess = true;
            string? directId = directSource?.ExternalId;
            ExternalMetadataReleaseCandidate[] candidates =
            [
                .. OrderSearchCandidates(
                        search.Value.Items,
                        searchQuery)
                    .Where(candidate =>
                        !string.Equals(
                            candidate.Source.ExternalId,
                            directId,
                            StringComparison.Ordinal))
                    .Take(_options.MaxOriginalSearchResultsPerRoute)
            ];
            foreach (ExternalMetadataReleaseCandidate candidate in candidates)
            {
                ExternalMetadataResult<ExternalMetadataReleaseDetail> detail =
                    await _discogsProvider.GetReleaseAsync(
                        new ExternalMetadataLookupQuery(
                            candidate.Source.ExternalId),
                        routeBudget,
                        cancellationToken);
                if (!detail.IsSuccess)
                {
                    providerFailure = true;
                    state.AddFailure(detail.Error);
                    state.AddRetry(route, musicBrainzRelease);
                    if (IsDiscoveryExhausted(detail.Error))
                    {
                        return true;
                    }

                    continue;
                }

                state.AnyDiscogsSuccess = true;
                matches.Add(_matcher.Match(
                    MatchInput(
                        state,
                        route,
                        musicBrainzRelease,
                        detail.Value,
                        ExternalReleaseRouteMatchAuthority.DeterministicEvidence)));
            }

            AddBindings(state, route, matches);
            if (!providerFailure &&
                !matches.Any(match =>
                    match.Outcome is
                        ExternalReleaseRouteMatchOutcome.Matched or
                        ExternalReleaseRouteMatchOutcome.AmbiguousRows))
            {
                state.AddWarning("discogs.match_not_found");
            }

            return false;
        }
        finally
        {
            checked
            {
                state.OutboundRequestCount += routeBudget.UsedRequestCount;
            }
        }
    }

    private static ExternalReleaseRouteMatchInput MatchInput(
        CandidateState state,
        RecordingReleaseRoute route,
        ExternalMetadataReleaseDetail musicBrainzRelease,
        ExternalMetadataReleaseDetail discogsRelease,
        ExternalReleaseRouteMatchAuthority authority)
    {
        return new ExternalReleaseRouteMatchInput
        {
            MusicBrainzRelease = musicBrainzRelease,
            MusicBrainzMediumPosition = route.MediumPosition,
            MusicBrainzTrackMbid = route.MusicBrainzTrackMbid,
            MusicBrainzRecordingMbid =
                state.RecordingSource.ExternalId,
            DiscogsRelease = discogsRelease,
            Authority = authority
        };
    }

    private ExternalMetadataReleaseSearchQuery SearchQuery(
        ExternalMetadataReleaseDetail release)
    {
        string? barcode = release.Identifiers
            .FirstOrDefault(identifier =>
                string.Equals(
                    identifier.Type,
                    "barcode",
                    StringComparison.OrdinalIgnoreCase))
            ?.Value;
        return new ExternalMetadataReleaseSearchQuery(
            Artist: release.Artists.Count > 0
                ? release.Artists[0]
                : null,
            Title: release.Title,
            Year: release.Year,
            Barcode: barcode,
            CatalogNumber: release.CatalogNumber,
            TrackCount: release.TracklistComplete
                ? release.Tracklist.Count
                : null,
            Limit: _options.MaxOriginalSearchResultsPerRoute);
    }

    private static void AddBindings(
        CandidateState state,
        RecordingReleaseRoute route,
        IReadOnlyList<ExternalReleaseRouteMatchResult> matches)
    {
        (DiscogsReleaseRouteBinding Binding, ExternalReleaseRouteMatchResult Match)[]
            bindings =
        [
            .. matches
                .Where(match =>
                    match.Outcome is ExternalReleaseRouteMatchOutcome.Matched
                        or ExternalReleaseRouteMatchOutcome.AmbiguousRows)
                .SelectMany(match =>
                    match.CompatibleRows.Select(binding => (binding, match)))
        ];
        foreach ((DiscogsReleaseRouteBinding binding,
            ExternalReleaseRouteMatchResult match) in bindings)
        {
            state.Routes.Add(new ExternalReleaseRouteCandidate
            {
                MusicBrainzRoute = route,
                DiscogsBinding = binding,
                IsPreferred = false,
                EvidenceCodes = match.EvidenceCodes
            });
        }
    }
}
