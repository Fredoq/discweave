using System.Text.Json;

namespace DiscWeave.Domain.Imports;

public sealed partial class ReleaseImportDraft
{
    public void UnionAuthoritativeExternalSources(
        IReadOnlyCollection<ReleaseImportProviderReference> authoritativeSources)
    {
        ArgumentNullException.ThrowIfNull(authoritativeSources);
        List<ReleaseImportProviderReference> union = [.. ExternalSources];
        foreach (ReleaseImportProviderReference source in authoritativeSources)
        {
            ArgumentNullException.ThrowIfNull(source);
            var canonical = ReleaseImportProviderReference.Create(
                source.ProviderCode,
                source.ResourceType,
                source.ExternalId,
                source.SourceUrl);
            int existingIndex = union.FindIndex(existing =>
                existing.ProviderCode == canonical.ProviderCode &&
                existing.ResourceType == canonical.ResourceType &&
                existing.ExternalId == canonical.ExternalId);
            if (existingIndex >= 0)
            {
                union[existingIndex] = canonical;
            }
            else
            {
                union.Add(canonical);
            }
        }

        _externalSourcesJson = SerializeExternalSources(union);
    }

    private static string SerializeExternalSources(IReadOnlyList<ReleaseImportProviderReference>? sources)
    {
        return JsonSerializer.Serialize((sources ?? [])
            .OrderBy(source => source.ProviderCode, StringComparer.Ordinal)
            .ThenBy(source => source.ResourceType, StringComparer.Ordinal)
            .ThenBy(source => source.ExternalId, StringComparer.Ordinal)
            .ThenBy(source => source.SourceUrl, StringComparer.Ordinal)
            .Select(source => new ReleaseImportExternalSourceReference(
                source.ProviderCode,
                source.ResourceType,
                source.ExternalId,
                source.SourceUrl)));
    }

    private static IReadOnlyList<ReleaseImportProviderReference> DeserializeExternalSources(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        ReleaseImportExternalSourceReference[] sources =
            JsonSerializer.Deserialize<ReleaseImportExternalSourceReference[]>(json) ?? [];

        return
        [
            .. sources.Select(source => ReleaseImportProviderReference.Create(
                source.ProviderCode,
                source.ResourceType,
                source.ExternalId,
                source.SourceUrl))
        ];
    }

    private sealed record ReleaseImportExternalSourceReference(
        string ProviderCode,
        string ResourceType,
        string ExternalId,
        string SourceUrl);
}
