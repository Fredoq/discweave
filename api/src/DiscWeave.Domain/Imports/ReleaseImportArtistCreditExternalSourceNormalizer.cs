namespace DiscWeave.Domain.Imports;

internal static class ReleaseImportArtistCreditExternalSourceNormalizer
{
    public static ReleaseImportArtistCreditExternalSource? Normalize(ReleaseImportArtistCreditExternalSource? source)
    {
        if (source is null)
        {
            return null;
        }

        string? providerName = TrimOrNull(source.ProviderName);
        string? resourceType = TrimOrNull(source.ResourceType);
        string? externalId = TrimOrNull(source.ExternalId);
        string? sourceUrl = TrimOrNull(source.SourceUrl) ?? DiscogsArtistSourceUrl(providerName, resourceType, externalId);

        return providerName is null || resourceType is null || externalId is null || sourceUrl is null
            ? null
            : new ReleaseImportArtistCreditExternalSource(providerName, resourceType, externalId, sourceUrl);
    }

    private static string? DiscogsArtistSourceUrl(string? providerName, string? resourceType, string? externalId)
    {
        return string.Equals(providerName, "discogs", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(resourceType, "artist", StringComparison.OrdinalIgnoreCase) &&
            externalId is not null
            ? $"https://www.discogs.com/artist/{Uri.EscapeDataString(externalId)}"
            : null;
    }

    private static string? TrimOrNull(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
