using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Features.Discover;

public static partial class DiscoverIdentity
{
    public static string Normalize(string value)
    {
        return string.Concat(value.Normalize(NormalizationForm.FormKC)
            .Where(char.IsLetterOrDigit)).ToUpperInvariant();
    }

    public static bool Matches(DiscoverLead lead, ExternalMetadataReleaseDetail release)
    {
        return Normalize(lead.Title) == Normalize(release.Title) &&
            release.Artists.Any(artist => Normalize(artist) == Normalize(lead.Artist)) &&
            IsDiscogsRelease(release.Source);
    }

    public static bool IsDiscogsRelease(ExternalMetadataSource source)
    {
        return source.ProviderName == "discogs" && source.ResourceType == "release" &&
            long.TryParse(source.ExternalId, NumberStyles.None, CultureInfo.InvariantCulture, out long id) && id > 0 &&
            Uri.TryCreate(source.SourceUrl, UriKind.Absolute, out Uri? uri) && uri.Scheme == "https" && uri.IsDefaultPort && uri.UserInfo.Length == 0 &&
            uri.Host is "www.discogs.com" or "discogs.com" &&
            (uri.AbsolutePath == $"/release/{source.ExternalId}" || uri.AbsolutePath.StartsWith($"/release/{source.ExternalId}-", StringComparison.Ordinal));
    }

    public static string[] Keys(ExternalMetadataReleaseDetail release)
    {
        return ["release:" + release.Source.ExternalId, .. release.RelatedSources
            .Where(source => source.ProviderName == "discogs" && source.ResourceType == "master" &&
                long.TryParse(source.ExternalId, NumberStyles.None, CultureInfo.InvariantCulture, out long id) && id > 0)
            .Select(source => MasterKey(source.ExternalId, release.Title, release.Tracklist.Select(track => track.Title)))];
    }

    // A master groups editions, but can also group alternate performances. Only
    // compare the same title and explicit recording-variant signature.
    public static string MasterKey(string externalId, string title, IEnumerable<string> trackTitles)
    {
        string variants = string.Join('|', trackTitles.Where(IsRecordingVariant).Select(Normalize).Distinct().Order(StringComparer.Ordinal));
        return "master:" + externalId + ":" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(Normalize(title) + ":" + variants)));
    }

    public static bool HasRecordingVariant(ExternalMetadataReleaseDetail release) =>
        IsRecordingVariant(release.Title) || release.Tracklist.Any(track => IsRecordingVariant(track.Title));

    private static bool IsRecordingVariant(string title) => RecordingVariantPattern().IsMatch(title);

    [GeneratedRegex(@"\b(remix|mix|live|edit|version|acoustic|re-recorded|rerecorded)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex RecordingVariantPattern();

    public static string TitleKey(string title, IEnumerable<string> artists)
    {
        return Normalize(title) + "|" + string.Join('|', artists.Select(Normalize).Order(StringComparer.Ordinal));
    }
}
