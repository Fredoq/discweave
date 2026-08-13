namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportMusicBrainzRowDto(
    string ReleaseMbid,
    string MediumPosition,
    string TrackMbid);
