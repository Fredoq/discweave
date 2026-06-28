using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Interfaces;

namespace DiscWeave.Domain.Settings;

public sealed class TrackStackSettings : IEntity<CollectionId>
{
    private string _defaultRelationTypeCodes = string.Empty;

    private TrackStackSettings()
    {
    }

    private TrackStackSettings(CollectionId collectionId, IReadOnlyList<string> defaultRelationTypeCodes)
    {
        CollectionId = collectionId;
        UpdateDefaultRelationTypeCodes(defaultRelationTypeCodes);
    }

    public CollectionId Id => CollectionId;

    public CollectionId CollectionId { get; private set; }

    public IReadOnlyList<string> DefaultRelationTypeCodes => string.IsNullOrWhiteSpace(_defaultRelationTypeCodes)
        ? []
        : _defaultRelationTypeCodes.Split('\n', StringSplitOptions.RemoveEmptyEntries);

    public static TrackStackSettings Create(CollectionId collectionId, IReadOnlyList<string> defaultRelationTypeCodes)
    {
        return new TrackStackSettings(collectionId, defaultRelationTypeCodes);
    }

    public void UpdateDefaultRelationTypeCodes(IReadOnlyList<string> relationTypeCodes)
    {
        string[] normalizedCodes = [.. NormalizeRelationTypeCodes(relationTypeCodes)];
        _defaultRelationTypeCodes = string.Join('\n', normalizedCodes);
    }

    private static IEnumerable<string> NormalizeRelationTypeCodes(IReadOnlyList<string> relationTypeCodes)
    {
        HashSet<string> seen = new(StringComparer.Ordinal);
        foreach (string relationTypeCode in relationTypeCodes)
        {
            string normalized = TrackRelationTypeCode.Required(
                relationTypeCode,
                nameof(relationTypeCodes),
                "track_stack_settings.relation_type_required",
                "track_stack_settings.relation_type_invalid");
            if (seen.Add(normalized))
            {
                yield return normalized;
            }
        }
    }
}
