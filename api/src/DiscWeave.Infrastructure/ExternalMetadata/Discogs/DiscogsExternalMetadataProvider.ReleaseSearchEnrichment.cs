using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public sealed partial class DiscogsExternalMetadataProvider
{
    private async Task<ExternalMetadataReleaseCandidate[]> MapReleaseCandidatesAsync(
        IEnumerable<DiscogsSearchResult> results,
        string accessToken,
        CancellationToken cancellationToken)
    {
        List<ExternalMetadataReleaseCandidate> candidates = [];
        foreach (DiscogsSearchResult result in results)
        {
            candidates.Add(await MapReleaseCandidateAsync(result, accessToken, cancellationToken));
        }

        return [.. candidates];
    }

    private async Task<ExternalMetadataReleaseCandidate> MapReleaseCandidateAsync(
        DiscogsSearchResult result,
        string accessToken,
        CancellationToken cancellationToken)
    {
        ExternalMetadataReleaseCandidate candidate = MapReleaseCandidate(result);
        ExternalMetadataResult<DiscogsReleaseDetailResponse> detail =
            await SendAsync<DiscogsReleaseDetailResponse>(
                $"/releases/{result.Id.ToString(System.Globalization.CultureInfo.InvariantCulture)}",
                EmptyParameters,
                accessToken,
                cancellationToken);

        return detail.IsSuccess
            ? candidate with { TrackCount = MapReleaseTracklist(detail.Value.Tracklist).Length }
            : candidate;
    }
}
