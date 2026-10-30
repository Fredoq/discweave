using System.Globalization;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public sealed partial class DiscogsExternalMetadataProvider
{
    // A release matches when it fits all descriptive fields (query, artist, title,
    // year) OR its identifiers (catalog number, barcode), and in both cases the
    // track count when one is given.
    private async Task<ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>>> SearchReleaseBranchesAsync(
        ExternalMetadataReleaseSearchQuery query,
        string accessToken,
        CancellationToken cancellationToken)
    {
        bool hasIdentifier = HasText(query.CatalogNumber) || HasText(query.Barcode);
        bool hasDescriptive = HasText(query.Query) || HasText(query.Artist) || HasText(query.Title) || query.Year.HasValue;
        bool searchDescriptive = hasDescriptive || !hasIdentifier;

        DiscogsSearchResponse? identifierResponse = null;
        if (hasIdentifier)
        {
            Dictionary<string, string> parameters = SearchParameters(query.Limit, "release");
            Add(parameters, "barcode", query.Barcode);
            Add(parameters, "catno", query.CatalogNumber);
            ExternalMetadataResult<DiscogsSearchResponse> response = await SearchReleaseResultsAsync(parameters, accessToken, cancellationToken);
            if (!response.IsSuccess)
            {
                return new ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>>(response.Error);
            }

            identifierResponse = response.Value;
        }

        DiscogsSearchResponse? descriptiveResponse = null;
        if (searchDescriptive)
        {
            Dictionary<string, string> parameters = SearchParameters(query.Limit, "release");
            Add(parameters, "q", query.Query);
            Add(parameters, "artist", query.Artist);
            Add(parameters, "release_title", query.Title);
            Add(parameters, "year", query.Year?.ToString(CultureInfo.InvariantCulture));
            ExternalMetadataResult<DiscogsSearchResponse> response = await SearchReleaseResultsAsync(parameters, accessToken, cancellationToken);
            if (!response.IsSuccess)
            {
                return new ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>>(response.Error);
            }

            descriptiveResponse = response.Value;
        }

        DiscogsSearchResult[] results =
        [
            .. ReleaseResults(identifierResponse)
                .Concat(ReleaseResults(descriptiveResponse))
                .DistinctBy(result => result.Id)
        ];
        ExternalMetadataReleaseCandidate[] candidates = await MapReleaseCandidatesAsync(results, accessToken, cancellationToken);
        if (query.TrackCount is int trackCount)
        {
            candidates = [.. candidates.Where(candidate => candidate.TrackCount == trackCount)];
        }

        bool isMerged = identifierResponse is not null && descriptiveResponse is not null;
        int? total = query.TrackCount.HasValue || isMerged
            ? candidates.Length
            : (identifierResponse ?? descriptiveResponse)?.Pagination?.Items;

        return new ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>>(
            new ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>(
                [.. candidates.Take(Math.Clamp(query.Limit, 1, 100))], total));
    }

    private async Task<ExternalMetadataResult<DiscogsSearchResponse>> SearchReleaseResultsAsync(
        Dictionary<string, string> parameters,
        string accessToken,
        CancellationToken cancellationToken)
    {
        ExternalMetadataResult<DiscogsSearchResponse> response = await SendAsync<DiscogsSearchResponse>(
            "/database/search",
            parameters,
            accessToken,
            cancellationToken);

        return !response.IsSuccess || HasValidSearchStructure(response.Value)
            ? response
            : new ExternalMetadataResult<DiscogsSearchResponse>(InvalidResponse());
    }

    private static DiscogsSearchResult[] ReleaseResults(DiscogsSearchResponse? response)
    {
        return response is null
            ? []
            : [.. response.Results.Where(result => string.Equals(result.Type, "release", StringComparison.OrdinalIgnoreCase))];
    }

    private static bool HasText(string? value)
    {
        return !string.IsNullOrWhiteSpace(value);
    }
}
