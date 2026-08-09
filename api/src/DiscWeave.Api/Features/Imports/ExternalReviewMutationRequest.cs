namespace DiscWeave.Api.Features.Imports;

public sealed record ExternalReviewMutationRequest
{
    public required long ExpectedReviewRevision { get; init; }
}
