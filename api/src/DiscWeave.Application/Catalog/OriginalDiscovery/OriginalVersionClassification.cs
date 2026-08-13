namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record OriginalVersionClassification
{
    public required string BaseTitle { get; init; }
    public string? Marker { get; init; }
    public required IReadOnlySet<OriginalVersionKind> Kinds { get; init; }
}
