namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportProviderReferenceRequest
{
    public required string ProviderCode { get; init; }

    public required string ResourceType { get; init; }

    public required string ExternalId { get; init; }

    public required string SourceUrl { get; init; }
}
