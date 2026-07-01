using System.Text.Json;
using DiscWeave.Domain.Catalog;

namespace DiscWeave.Domain.Imports;

public sealed partial class ReleaseImportDraft
{
    private static string SerializeExternalSources(IReadOnlyList<ExternalSourceReference>? sources)
    {
        return JsonSerializer.Serialize(
            sources?.Select(source => new ReleaseImportExternalSourceReference(
                source.ProviderName,
                source.ResourceType,
                source.ExternalId,
                source.SourceUrl,
                source.AppliedAt)) ?? []);
    }

    private static IReadOnlyList<ExternalSourceReference> DeserializeExternalSources(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        ReleaseImportExternalSourceReference[] sources =
            JsonSerializer.Deserialize<ReleaseImportExternalSourceReference[]>(json) ?? [];

        return
        [
            .. sources.Select(source => ExternalSourceReference.Create(
                source.ProviderName,
                source.ResourceType,
                source.ExternalId,
                source.SourceUrl,
                source.AppliedAt))
        ];
    }

    private sealed record ReleaseImportExternalSourceReference(
        string ProviderName,
        string ResourceType,
        string ExternalId,
        string SourceUrl,
        DateTimeOffset AppliedAt);
}
