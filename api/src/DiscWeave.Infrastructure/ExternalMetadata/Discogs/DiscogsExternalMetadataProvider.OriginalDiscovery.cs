using System.Globalization;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public sealed partial class DiscogsExternalMetadataProvider
{
    internal async Task<ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>>> SearchReleasesAsync(
        ExternalMetadataReleaseSearchQuery query,
        DiscogsOriginalRouteRequestBudget requestBudget,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        ArgumentNullException.ThrowIfNull(requestBudget);

        DiscogsProviderConfiguration configuration =
            await ValidateConfigurationAsync(cancellationToken);
        if (configuration.Error is not null)
        {
            return new ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>>(
                configuration.Error);
        }

        Dictionary<string, string> parameters = SearchParameters(
            query.Limit,
            "release");
        Add(parameters, "q", query.Query);
        Add(parameters, "artist", query.Artist);
        Add(parameters, "release_title", query.Title);
        Add(parameters, "year", query.Year?.ToString(CultureInfo.InvariantCulture));
        Add(parameters, "barcode", query.Barcode);
        Add(parameters, "catno", query.CatalogNumber);
        ExternalMetadataResult<DiscogsSearchResponse> response =
            await SendAsync<DiscogsSearchResponse>(
                "/database/search",
                parameters,
                configuration.AccessToken,
                requestBudget,
                cancellationToken);
        if (!response.IsSuccess)
        {
            return new ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>>(
                response.Error);
        }

        if (!HasValidSearchStructure(response.Value))
        {
            return new ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>>(
                InvalidResponse());
        }

        ExternalMetadataReleaseCandidate[] candidates =
        [
            .. response.Value.Results
                .Where(result =>
                    string.Equals(
                        result.Type,
                        "release",
                        StringComparison.OrdinalIgnoreCase))
                .Select(MapReleaseCandidate)
        ];
        return new ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>>(
            new ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>(
                candidates,
                response.Value.Pagination?.Items));
    }

    internal async Task<ExternalMetadataResult<ExternalMetadataReleaseDetail>> GetReleaseAsync(
        ExternalMetadataLookupQuery query,
        DiscogsOriginalRouteRequestBudget requestBudget,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        ArgumentNullException.ThrowIfNull(requestBudget);

        DiscogsProviderConfiguration configuration =
            await ValidateConfigurationAsync(cancellationToken);
        if (configuration.Error is not null)
        {
            return new ExternalMetadataResult<ExternalMetadataReleaseDetail>(
                configuration.Error);
        }

        ExternalMetadataResult<DiscogsReleaseDetailResponse> response =
            await SendAsync<DiscogsReleaseDetailResponse>(
                $"/releases/{Uri.EscapeDataString(query.ExternalId)}",
                EmptyParameters,
                configuration.AccessToken,
                requestBudget,
                cancellationToken);
        return ToReleaseDetailResult(response, query.ExternalId);
    }
}
