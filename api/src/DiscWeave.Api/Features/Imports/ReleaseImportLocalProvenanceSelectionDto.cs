namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportLocalProvenanceSelectionDto(
    Guid? SelectedReleaseId,
    Guid? SelectedTrackId);
