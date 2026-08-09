namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record ExternalProviderSearchDiagnostic
{
    public required string ProviderCode { get; init; }
    public required string RequestUrl { get; init; }
    public int? TotalResults { get; init; }
    public required int Offset { get; init; }
    public required IReadOnlyList<ExternalProviderSearchDiagnosticItem> Items { get; init; }
}

public sealed record ExternalProviderSearchDiagnosticItem
{
    public required string ExternalId { get; init; }
    public required string Title { get; init; }
    public required IReadOnlyList<string> Artists { get; init; }
    public TimeSpan? Duration { get; init; }
    public int? Score { get; init; }
}
