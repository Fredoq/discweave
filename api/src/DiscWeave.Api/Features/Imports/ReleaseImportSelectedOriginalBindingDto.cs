namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportSelectedOriginalBindingDto(
    Guid SourceTrackId,
    Guid DraftTrackId,
    ReleaseImportProviderReferenceResponse RecordingSource,
    ReleaseImportExternalReleaseRouteDto ReleaseRoute,
    ReleaseImportMusicBrainzRowDto MusicBrainzRow,
    ReleaseImportDiscogsRowDto? DiscogsRow,
    bool PromoteLinkedTargetConfirmed);
