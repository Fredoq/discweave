namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportCollectionItemIntentDto(
    string Kind,
    ReleaseImportMediumIntentDto? Medium,
    Guid? OwnedItemId,
    ReleaseImportMediumIntentDto? ExpectedMedium);
