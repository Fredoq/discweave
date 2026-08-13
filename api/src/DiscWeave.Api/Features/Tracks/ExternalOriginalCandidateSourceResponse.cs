namespace DiscWeave.Api.Features.Tracks;

public sealed record ExternalOriginalCandidateSourceResponse
{
    public required string ProviderCode { get; init; }
    public required string ResourceType { get; init; }
    public required string ExternalId { get; init; }
    public required string SourceUrl { get; init; }
    public required string Attribution { get; init; }
}
