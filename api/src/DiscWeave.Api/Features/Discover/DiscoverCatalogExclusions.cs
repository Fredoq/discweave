namespace DiscWeave.Api.Features.Discover;

public sealed record DiscoverCatalogExclusions(HashSet<string> Keys, HashSet<string> Titles);
