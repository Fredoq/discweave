namespace DiscWeave.Api.Features.Discover;

public sealed record DiscoverProfileResponse(string ProfileToken, IReadOnlyList<DiscoverExample> Examples, int TotalRated, bool Sampled, DiscoverContext? Context, IReadOnlyList<DiscoverLead> Avoid);
