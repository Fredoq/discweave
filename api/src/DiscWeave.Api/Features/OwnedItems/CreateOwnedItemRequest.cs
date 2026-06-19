namespace DiscWeave.Api.Features.OwnedItems;

public sealed record CreateOwnedItemRequest(
    Guid? ReleaseId,
    string Status,
    MediumRequest Medium,
    string? Condition,
    string? StorageLocation);
