using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ExternalReleaseDraftService
{
    private static (ReleaseImportProviderReference? RecordingSource,
        MusicBrainzReleaseRowLocator? MusicBrainzRow,
        DiscogsReleaseRowLocator? DiscogsRow,
        ExternalReleaseRoute ReleaseRoute,
        string Fingerprint) BuildCanonicalRequest(
        TrackId sourceTrackId,
        ExternalReleaseDraftRequest request)
    {
        if (request.MusicBrainzRow is null && request.DiscogsRoute is { } selected)
        {
            var row = DiscogsReleaseRowLocator.Create(selected.ReleaseId, selected.RowOrdinal, selected.Position, selected.Fingerprint);
            return (null, null, row,
                ExternalReleaseRoute.CreateDiscogs(ExternalReleaseProviderReferenceFactory.DiscogsRelease(row.ReleaseId)),
                ExternalReleaseImportRequestFingerprint.CreateDiscogs(sourceTrackId, row, request.ReviewedRelationTypeCode));
        }

        ArgumentNullException.ThrowIfNull(request.MusicBrainzRow);
        if (sourceTrackId.Value == Guid.Empty || request.RecordingMbid == Guid.Empty)
        {
            throw InvalidRequest("Source track and Recording IDs are required");
        }

        var musicBrainzRow = MusicBrainzReleaseRowLocator.Create(
            request.MusicBrainzRow.ReleaseMbid.ToString("D"),
            request.MusicBrainzRow.MediumPosition,
            request.MusicBrainzRow.TrackMbid.ToString("D"));
        ReleaseImportProviderReference recordingSource =
            ExternalReleaseProviderReferenceFactory.MusicBrainzRecording(request.RecordingMbid);
        DiscogsReleaseRowLocator? discogsRow = request.DiscogsRoute is null
            ? null
            : DiscogsReleaseRowLocator.Create(
                request.DiscogsRoute.ReleaseId,
                request.DiscogsRoute.RowOrdinal,
                request.DiscogsRoute.Position,
                request.DiscogsRoute.Fingerprint);
        ReleaseImportProviderReference musicBrainzRelease =
            ExternalReleaseProviderReferenceFactory.MusicBrainzRelease(request.MusicBrainzRow.ReleaseMbid);
        ExternalReleaseRoute route = discogsRow is null
            ? ExternalReleaseRoute.CreateMusicBrainz(musicBrainzRelease)
            : ExternalReleaseRoute.CreateDiscogsBacked(
                musicBrainzRelease,
                ExternalReleaseProviderReferenceFactory.DiscogsRelease(discogsRow.ReleaseId));
        IOptionalValue<DiscogsReleaseRowLocator> optionalDiscogsRow = discogsRow is null
            ? Optional.Missing<DiscogsReleaseRowLocator>()
            : Optional.From(discogsRow);
        string fingerprint = ExternalReleaseImportRequestFingerprint.Create(
            sourceTrackId,
            recordingSource,
            musicBrainzRow,
            optionalDiscogsRow,
            request.ReviewedRelationTypeCode);
        return (recordingSource, musicBrainzRow, discogsRow, route, fingerprint);
    }

    private static DomainException InvalidRequest(string message)
    {
        return new DomainException("import.external_request_invalid", message);
    }
}
