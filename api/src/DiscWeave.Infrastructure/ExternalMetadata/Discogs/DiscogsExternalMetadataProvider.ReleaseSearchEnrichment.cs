using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public sealed partial class DiscogsExternalMetadataProvider
{
    private const int ReleaseCandidateDetailConcurrency = 4;

    private async Task<ExternalMetadataReleaseCandidate[]> MapReleaseCandidatesAsync(
        IEnumerable<DiscogsSearchResult> results,
        string accessToken,
        CancellationToken cancellationToken)
    {
        using var concurrency = new SemaphoreSlim(ReleaseCandidateDetailConcurrency);
        Task<ExternalMetadataReleaseCandidate>[] candidateTasks =
        [
            .. results.Select(result => MapReleaseCandidateAsync(result, accessToken, concurrency, cancellationToken))
        ];

        return await Task.WhenAll(candidateTasks);
    }

    private async Task<ExternalMetadataReleaseCandidate> MapReleaseCandidateAsync(
        DiscogsSearchResult result,
        string accessToken,
        SemaphoreSlim concurrency,
        CancellationToken cancellationToken)
    {
        await concurrency.WaitAsync(cancellationToken);
        try
        {
            return await MapReleaseCandidateAsync(result, accessToken, cancellationToken);
        }
        finally
        {
            _ = concurrency.Release();
        }
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
