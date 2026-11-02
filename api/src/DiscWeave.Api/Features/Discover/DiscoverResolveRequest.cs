namespace DiscWeave.Api.Features.Discover;

public sealed record DiscoverResolveRequest(string ProfileToken, IReadOnlyList<DiscoverLead> Leads);
