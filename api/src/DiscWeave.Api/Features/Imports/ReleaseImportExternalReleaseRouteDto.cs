namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportExternalReleaseRouteDto(
    ReleaseImportProviderReferenceResponse? MusicBrainzRelease,
    ReleaseImportProviderReferenceResponse? DiscogsRelease);
