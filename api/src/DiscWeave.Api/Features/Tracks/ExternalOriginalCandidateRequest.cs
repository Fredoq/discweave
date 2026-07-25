namespace DiscWeave.Api.Features.Tracks;

public sealed record ExternalOriginalCandidateRequest
{
    public IReadOnlyCollection<string>? ProviderCodes { get; init; }
}
