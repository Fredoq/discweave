using System.Globalization;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ExternalReleaseBindingValidator
{
    public async Task<ExternalMetadataResult<ExternalMetadataReleaseDetail>> GetRecommendedReleaseAsync(
        string discogsReleaseId,
        CancellationToken cancellationToken)
    {
        if (!long.TryParse(discogsReleaseId, NumberStyles.None, CultureInfo.InvariantCulture, out long id) || id <= 0)
        {
            return InvalidRecommendedRelease();
        }

        string canonicalId = id.ToString(CultureInfo.InvariantCulture);
        ExternalMetadataResult<IExternalMetadataProvider> provider = _providerResolver.Resolve("discogs");
        if (!provider.IsSuccess)
        {
            return new ExternalMetadataResult<ExternalMetadataReleaseDetail>(provider.Error);
        }

        ExternalMetadataResult<ExternalMetadataReleaseDetail> result = await provider.Value.GetReleaseAsync(
            new ExternalMetadataLookupQuery(canonicalId), ExternalMetadataRequestFreshness.Authoritative, cancellationToken);
        if (!result.IsSuccess)
        {
            return result;
        }

        ExternalMetadataReleaseDetail release = result.Value;
        return release.Source.ProviderName == "discogs" && release.Source.ResourceType == "release" &&
            release.Source.ExternalId == canonicalId && HasCanonicalReleaseUrl(release.Source.SourceUrl, canonicalId) &&
            !string.IsNullOrWhiteSpace(release.Title) && release.Artists.Count > 0 &&
            release.Artists.All(artist => !string.IsNullOrWhiteSpace(artist)) &&
            release.Tracklist.All(track => !string.IsNullOrWhiteSpace(track.Title)) &&
            release.TracklistComplete && release.Tracklist.Count is > 0 and <= 500
            ? result
            : InvalidRecommendedRelease();
    }

    private static bool HasCanonicalReleaseUrl(string sourceUrl, string releaseId)
    {
        return Uri.TryCreate(sourceUrl, UriKind.Absolute, out Uri? uri) && uri.Scheme == "https" &&
            uri.Host is "www.discogs.com" or "discogs.com" && uri.UserInfo.Length == 0 &&
            (uri.AbsolutePath == $"/release/{releaseId}" || uri.AbsolutePath.StartsWith($"/release/{releaseId}-", StringComparison.Ordinal));
    }

    private static ExternalMetadataResult<ExternalMetadataReleaseDetail> InvalidRecommendedRelease()
    {
        return new ExternalMetadataResult<ExternalMetadataReleaseDetail>(new ExternalMetadataError(
            ExternalMetadataErrorKind.InvalidResponse, "import.recommended_release_invalid",
            "The provider release identity or tracklist could not be verified"));
    }
}
