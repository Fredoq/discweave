using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Features.Discover;

public sealed record DiscoverSnapshot(CollectionId CollectionId, IReadOnlyList<DiscoverExample> Examples, string Mode, DateTimeOffset ExpiresAt, DiscoverContext? Context = null);
