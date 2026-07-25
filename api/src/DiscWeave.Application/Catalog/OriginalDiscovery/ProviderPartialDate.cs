namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record ProviderPartialDate
{
    public required int Year { get; init; }
    public int? Month { get; init; }
    public int? Day { get; init; }
}
