using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Api.Features.Tracks;

public sealed partial class ExternalOriginalCandidateService
{
    private const string DiscogsProviderCode = "discogs";

    private async Task<IReadOnlyList<DiscogsOriginalCandidate>> FindDiscogsOriginalsAsync(
        LocalOriginalCandidateResult local,
        List<ExternalProviderOperationStatus> statuses,
        SortedSet<string> warnings,
        CancellationToken cancellationToken)
    {
        if (local.Source is not { } source || string.IsNullOrWhiteSpace(source.BaseTitle) || source.Artists.Count == 0)
        {
            return [];
        }

        ExternalMetadataResult<IExternalMetadataProvider> provider = _providerResolver.Resolve(DiscogsProviderCode);
        if (!provider.IsSuccess)
        {
            if (provider.Error.Kind != ExternalMetadataErrorKind.UnknownProvider)
            {
                statuses.Add(ToStatus(DiscogsProviderCode, provider.Error));
            }

            return [];
        }
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(30));
        var candidates = new List<DiscogsOriginalCandidate>();
        ExternalProviderOperationStatus status;
        try
        {
            // ponytail: inspect five releases; add pagination if real misses exceed this bounded shortlist.
            ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>> search = await provider.Value.SearchReleasesAsync(new ExternalMetadataReleaseSearchQuery(
                Title: source.BaseTitle, Artist: source.Artists[0], Limit: 5), timeout.Token);
            status = !search.IsSuccess
                ? ToStatus(DiscogsProviderCode, search.Error)
                : await LoadDiscogsOriginalsAsync(
                    provider.Value, search.Value.Items, source, candidates, warnings, timeout.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            status = new ExternalProviderOperationStatus { ProviderCode = DiscogsProviderCode, Outcome = ExternalProviderOperationOutcome.Timeout };
            _ = warnings.Add("discogs.original_search_timeout");
        }
        _ = statuses.RemoveAll(item => item.ProviderCode == DiscogsProviderCode);
        statuses.Add(status);
        return candidates;
    }

    private static async Task<ExternalProviderOperationStatus> LoadDiscogsOriginalsAsync(
        IExternalMetadataProvider provider,
        IReadOnlyList<ExternalMetadataReleaseCandidate> releases,
        LocalOriginalSourceFacts source,
        List<DiscogsOriginalCandidate> candidates,
        SortedSet<string> warnings,
        CancellationToken cancellationToken)
    {
        ExternalProviderOperationStatus status = new()
        {
            ProviderCode = DiscogsProviderCode,
            Outcome = ExternalProviderOperationOutcome.Succeeded
        };
        foreach (ExternalMetadataSource releaseSource in releases
            .DistinctBy(item => item.Source.ExternalId).Take(5).Select(item => item.Source))
        {
            if (releaseSource.ProviderName != DiscogsProviderCode || releaseSource.ResourceType != "release" ||
                !long.TryParse(releaseSource.ExternalId, out long id) || id <= 0)
            {
                continue;
            }

            ExternalMetadataResult<ExternalMetadataReleaseDetail> detail = await provider.GetReleaseAsync(
                new ExternalMetadataLookupQuery(releaseSource.ExternalId), cancellationToken);
            if (!detail.IsSuccess)
            {
                status = ToStatus(DiscogsProviderCode, detail.Error);
                _ = warnings.Add("discogs.original_release_lookup_incomplete");
                continue;
            }

            if (detail.Value.Source.ProviderName == DiscogsProviderCode && detail.Value.Source.ResourceType == "release" &&
                detail.Value.Source.ExternalId == releaseSource.ExternalId)
            {
                AddDiscogsOriginals(detail.Value, source, candidates);
            }
        }

        return status;
    }

    private static void AddDiscogsOriginals(
        ExternalMetadataReleaseDetail release,
        LocalOriginalSourceFacts source,
        List<DiscogsOriginalCandidate> candidates)
    {
        for (int index = 0; index < release.Tracklist.Count; index++)
        {
            ExternalMetadataReleaseTrack track = release.Tracklist[index];
            IReadOnlyList<string> artists = track.Artists.Count > 0 ? track.Artists : release.Artists;
            if (string.IsNullOrWhiteSpace(track.Position) ||
                OriginalDiscoveryTextNormalizer.ForTitleKey(track.Title) != OriginalDiscoveryTextNormalizer.ForTitleKey(source.BaseTitle) ||
                !artists.Any(artist => source.Artists.Any(expected =>
                    OriginalDiscoveryTextNormalizer.ForArtistKey(artist) == OriginalDiscoveryTextNormalizer.ForArtistKey(expected))))
            {
                continue;
            }

            candidates.Add(new DiscogsOriginalCandidate(release, index,
                DiscogsReleaseRowFingerprint.Create(track.Position, track.Title, artists, track.Duration),
                source.SuggestedRelationTypeCode));
        }
    }
}
