namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record ExternalProviderOperationStatus
{
    public required string ProviderCode { get; init; }
    public required ExternalProviderOperationOutcome Outcome { get; init; }
    public string? ErrorCode { get; init; }
    public TimeSpan? RetryAfter { get; init; }
}
