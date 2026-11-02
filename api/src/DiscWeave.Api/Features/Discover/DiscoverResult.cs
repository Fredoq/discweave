namespace DiscWeave.Api.Features.Discover;

public sealed record DiscoverResult(IReadOnlyList<DiscoverRelease> Items, string Message);
