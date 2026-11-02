namespace DiscWeave.Api.Features.Imports;

public sealed record RecommendedReleaseDraftRequest(string DiscogsReleaseId, string IdempotencyKey);
