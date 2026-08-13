using System.Text.Json;

namespace DiscWeave.Domain.Imports;

public sealed partial class ReleaseImportDraftTrack
{
    private string _externalSourcesJson = "[]";

    public IReadOnlyList<ReleaseImportProviderReference> ExternalSources =>
        DeserializeExternalSources(_externalSourcesJson);

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

    public void ReplaceBindingExternalSources(
        IReadOnlyCollection<ReleaseImportProviderReference> previousBindingSources,
        IReadOnlyCollection<ReleaseImportProviderReference> replacementSources)
    {
        ArgumentNullException.ThrowIfNull(previousBindingSources);
        ArgumentNullException.ThrowIfNull(replacementSources);
        var union = new List<ReleaseImportProviderReference>(
            ExternalSources.Where(existing => !previousBindingSources.Any(previous => SameIdentity(existing, previous))));
        foreach (ReleaseImportProviderReference source in replacementSources)
        {
            ArgumentNullException.ThrowIfNull(source);
            var canonical = ReleaseImportProviderReference.Create(
                source.ProviderCode,
                source.ResourceType,
                source.ExternalId,
                source.SourceUrl);
            int existingIndex = union.FindIndex(existing => SameIdentity(existing, canonical));
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

    private static bool SameIdentity(
        ReleaseImportProviderReference left,
        ReleaseImportProviderReference right)
    {
        return left.ProviderCode == right.ProviderCode &&
            left.ResourceType == right.ResourceType &&
            left.ExternalId == right.ExternalId;
    }

    private static string SerializeExternalSources(IReadOnlyList<ReleaseImportProviderReference>? sources)
    {
        return JsonSerializer.Serialize((sources ?? [])
            .OrderBy(source => source.ProviderCode, StringComparer.Ordinal)
            .ThenBy(source => source.ResourceType, StringComparer.Ordinal)
            .ThenBy(source => source.ExternalId, StringComparer.Ordinal)
            .ThenBy(source => source.SourceUrl, StringComparer.Ordinal)
            .Select(source => new ReleaseImportTrackExternalSourceReference(
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

        ReleaseImportTrackExternalSourceReference[] sources =
            JsonSerializer.Deserialize<ReleaseImportTrackExternalSourceReference[]>(json) ?? [];
        return
        [
            .. sources.Select(source => ReleaseImportProviderReference.Create(
                source.ProviderCode,
                source.ResourceType,
                source.ExternalId,
                source.SourceUrl))
        ];
    }

    private sealed record ReleaseImportTrackExternalSourceReference(
        string ProviderCode,
        string ResourceType,
        string ExternalId,
        string SourceUrl);
}
