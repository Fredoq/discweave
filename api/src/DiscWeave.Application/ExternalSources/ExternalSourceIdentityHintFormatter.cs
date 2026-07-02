using DiscWeave.Domain.Catalog;

namespace DiscWeave.Application.ExternalSources;

public static class ExternalSourceIdentityHintFormatter
{
    public static string? ArtistIdentityHint(IReadOnlyList<ExternalSourceReference> externalSources)
    {
        ExternalSourceReference? discogsArtist = externalSources.FirstOrDefault(source =>
            string.Equals(source.ProviderName, "discogs", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(source.ResourceType, "artist", StringComparison.OrdinalIgnoreCase));

        return discogsArtist is null ? null : $"Discogs #{discogsArtist.ExternalId}";
    }
}
