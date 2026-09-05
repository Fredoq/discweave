using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Api.Features.Tracks;

public sealed partial class ExternalOriginalCandidateService
{
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

        ExternalMetadataResult<IExternalMetadataProvider> provider = _providerResolver.Resolve("discogs");
        if (!provider.IsSuccess)
        {
            if (provider.Error.Kind != ExternalMetadataErrorKind.UnknownProvider)
            {
                statuses.Add(ToStatus("discogs", provider.Error));
            }

            return [];
        }
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(30));
        var candidates = new List<DiscogsOriginalCandidate>();
        ExternalProviderOperationStatus status = new() { ProviderCode = "discogs", Outcome = ExternalProviderOperationOutcome.Succeeded };
        try
        {
            // ponytail: inspect five releases; add pagination if real misses exceed this bounded shortlist.
            ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>> search = await provider.Value.SearchReleasesAsync(new ExternalMetadataReleaseSearchQuery(
                Title: source.BaseTitle, Artist: source.Artists[0], Limit: 5), timeout.Token);
            if (!search.IsSuccess)
            {
                status = ToStatus("discogs", search.Error);
            }
            else
            {
                foreach (ExternalMetadataReleaseCandidate result in search.Value.Items.DistinctBy(item => item.Source.ExternalId).Take(5))
                {
                    if (result.Source.ProviderName != "discogs" || result.Source.ResourceType != "release" ||
                        !long.TryParse(result.Source.ExternalId, out long id) || id <= 0)
                    {
                        continue;
                    }

                    ExternalMetadataResult<ExternalMetadataReleaseDetail> detail = await provider.Value.GetReleaseAsync(new ExternalMetadataLookupQuery(result.Source.ExternalId), timeout.Token);
                    if (!detail.IsSuccess)
                    {
                        status = ToStatus("discogs", detail.Error);
                        _ = warnings.Add("discogs.original_release_lookup_incomplete");
                        continue;
                    }
                    if (detail.Value.Source.ProviderName != "discogs" || detail.Value.Source.ResourceType != "release" ||
                        detail.Value.Source.ExternalId != result.Source.ExternalId)
                    {
                        continue;
                    }

                    for (int index = 0; index < detail.Value.Tracklist.Count; index++)
                    {
                        ExternalMetadataReleaseTrack track = detail.Value.Tracklist[index];
                        IReadOnlyList<string> artists = track.Artists.Count > 0 ? track.Artists : detail.Value.Artists;
                        if (string.IsNullOrWhiteSpace(track.Position) ||
                            OriginalDiscoveryTextNormalizer.ForTitleKey(track.Title) != OriginalDiscoveryTextNormalizer.ForTitleKey(source.BaseTitle) ||
                            !artists.Any(artist => source.Artists.Any(expected =>
                                OriginalDiscoveryTextNormalizer.ForArtistKey(artist) == OriginalDiscoveryTextNormalizer.ForArtistKey(expected))))
                        {
                            continue;
                        }

                        candidates.Add(new DiscogsOriginalCandidate(detail.Value, index,
                            DiscogsReleaseRowFingerprint.Create(track.Position, track.Title, artists, track.Duration),
                            source.SuggestedRelationTypeCode));
                    }
                }
            }
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            status = new ExternalProviderOperationStatus { ProviderCode = "discogs", Outcome = ExternalProviderOperationOutcome.Timeout };
            _ = warnings.Add("discogs.original_search_timeout");
        }
        _ = statuses.RemoveAll(item => item.ProviderCode == "discogs");
        statuses.Add(status);
        return candidates;
    }
}
