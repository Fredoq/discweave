using System.Globalization;
using System.Text;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Imports;

public static class ExternalReleaseImportRequestFingerprint
{
    public static string Create(
        TrackId sourceTrackId,
        ReleaseImportProviderReference recordingSource,
        MusicBrainzReleaseRowLocator musicBrainzRow,
        IOptionalValue<DiscogsReleaseRowLocator> discogsRow,
        string reviewedRelationTypeCode)
    {
        if (sourceTrackId.Value == Guid.Empty)
        {
            throw new DomainException("release_import.source_track_required", "Source track ID is required");
        }

        ArgumentNullException.ThrowIfNull(recordingSource);
        ArgumentNullException.ThrowIfNull(musicBrainzRow);
        ArgumentNullException.ThrowIfNull(discogsRow);
        if (recordingSource.ProviderCode != "musicbrainz" ||
            recordingSource.ResourceType != "recording" ||
            !Guid.TryParseExact(recordingSource.ExternalId, "D", out Guid recordingMbid) ||
            recordingMbid == Guid.Empty)
        {
            throw new DomainException(
                "release_import.recording_source_invalid",
                "External import fingerprint requires a MusicBrainz Recording reference");
        }

        string relationType = TrackRelationTypeCodeValue.From(
            reviewedRelationTypeCode.Normalize(NormalizationForm.FormKC).Trim()).Value;
        List<string> fields =
        [
            sourceTrackId.Value.ToString("D").ToLowerInvariant(),
            recordingMbid.ToString("D").ToLowerInvariant(),
            musicBrainzRow.ReleaseMbid.ToLowerInvariant(),
            musicBrainzRow.MediumPosition,
            musicBrainzRow.TrackMbid.ToLowerInvariant()
        ];
        _ = discogsRow.Match(
            row =>
            {
                fields.Add("present");
                fields.Add(row.ReleaseId);
                fields.Add(row.RowOrdinal.ToString(CultureInfo.InvariantCulture));
                fields.Add(row.Position);
                fields.Add(row.Fingerprint);
                return true;
            },
            () =>
            {
                fields.Add("missing");
                return true;
            });
        fields.Add(relationType);
        return LengthFramedSha256.Hash(fields);
    }
}
