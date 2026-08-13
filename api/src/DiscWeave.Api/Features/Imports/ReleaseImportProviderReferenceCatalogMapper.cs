using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;

namespace DiscWeave.Api.Features.Imports;

internal static class ReleaseImportProviderReferenceCatalogMapper
{
    internal static IReadOnlyList<ExternalSourceReference> ToCatalog(
        IReadOnlyList<ReleaseImportProviderReference> sources,
        DateTimeOffset appliedAt)
    {
        _ = appliedAt != default
            ? true
            : throw new ArgumentException("Catalog provenance timestamp is required", nameof(appliedAt));

        return
        [
            .. sources
                .OrderBy(source => source.ProviderCode, StringComparer.Ordinal)
                .ThenBy(source => source.ResourceType, StringComparer.Ordinal)
                .ThenBy(source => source.ExternalId, StringComparer.Ordinal)
                .ThenBy(source => source.SourceUrl, StringComparer.Ordinal)
                .Select(source => ExternalSourceReference.Create(
                    source.ProviderCode,
                    source.ResourceType,
                    source.ExternalId,
                    source.SourceUrl,
                    appliedAt))
        ];
    }
}
