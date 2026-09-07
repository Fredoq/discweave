namespace DiscWeave.Domain.Imports;

public sealed partial class ReleaseImportDraft
{
    private SelectedOriginalBinding? RehydrateBinding()
    {
        if (!_bindingSourceTrackId.HasValue || !_bindingDraftTrackId.HasValue)
        {
            return null;
        }

        if (_bindingRecordingExternalId is null && _bindingDiscogsReleaseExternalId is not null)
        {
            return _bindingRecordingSourceUrl is not null || _bindingMusicBrainzReleaseExternalId is not null ||
                _bindingMusicBrainzReleaseSourceUrl is not null || _bindingMusicBrainzReleaseMbid is not null ||
                _bindingMusicBrainzMediumPosition is not null || _bindingMusicBrainzTrackMbid is not null ||
                _bindingDiscogsReleaseExternalId != _bindingDiscogsRowReleaseId
                ? throw CorruptExternalReviewState()
                : Imports.SelectedOriginalBinding.CreateDiscogs(
                _bindingSourceTrackId.Value, _bindingDraftTrackId.Value,
                DiscogsReleaseRowLocator.Create(Required(_bindingDiscogsRowReleaseId),
                    _bindingDiscogsRowOrdinal ?? throw CorruptExternalReviewState(),
                    Required(_bindingDiscogsRowPosition), Required(_bindingDiscogsRowFingerprint)),
                _bindingPromoteLinkedTargetConfirmed);
        }

        var recording = ReleaseImportProviderReference.Create(
            "musicbrainz",
            "recording",
            Required(_bindingRecordingExternalId),
            Required(_bindingRecordingSourceUrl));
        var musicBrainzRelease = ReleaseImportProviderReference.Create(
            "musicbrainz",
            "release",
            Required(_bindingMusicBrainzReleaseExternalId),
            Required(_bindingMusicBrainzReleaseSourceUrl));
        var musicBrainzRow = MusicBrainzReleaseRowLocator.Create(
            Required(_bindingMusicBrainzReleaseMbid),
            Required(_bindingMusicBrainzMediumPosition),
            Required(_bindingMusicBrainzTrackMbid));
        if (_bindingDiscogsReleaseExternalId is null)
        {
            return Imports.SelectedOriginalBinding.CreateMusicBrainz(
                _bindingSourceTrackId.Value,
                _bindingDraftTrackId.Value,
                recording,
                ExternalReleaseRoute.CreateMusicBrainz(musicBrainzRelease),
                musicBrainzRow,
                _bindingPromoteLinkedTargetConfirmed);
        }

        var discogsRelease = ReleaseImportProviderReference.Create(
            "discogs",
            "release",
            _bindingDiscogsReleaseExternalId,
            Required(_bindingDiscogsReleaseSourceUrl));
        var discogsRow = DiscogsReleaseRowLocator.Create(
            Required(_bindingDiscogsRowReleaseId),
            _bindingDiscogsRowOrdinal ?? throw CorruptExternalReviewState(),
            Required(_bindingDiscogsRowPosition),
            Required(_bindingDiscogsRowFingerprint));
        return Imports.SelectedOriginalBinding.CreateDiscogsBacked(
            _bindingSourceTrackId.Value,
            _bindingDraftTrackId.Value,
            recording,
            ExternalReleaseRoute.CreateDiscogsBacked(musicBrainzRelease, discogsRelease),
            musicBrainzRow,
            discogsRow,
            _bindingPromoteLinkedTargetConfirmed);
    }

    private void PersistBinding(SelectedOriginalBinding binding)
    {
        ArgumentNullException.ThrowIfNull(binding);
        _selectedOriginalBinding = binding;
        _bindingSourceTrackId = binding.SourceTrackId;
        _bindingDraftTrackId = binding.DraftTrackId;
        _ = binding.Match(musicBrainz =>
        {
            _bindingRecordingExternalId = musicBrainz.RecordingSource.ExternalId;
            _bindingRecordingSourceUrl = musicBrainz.RecordingSource.SourceUrl;
            _bindingMusicBrainzReleaseExternalId = musicBrainz.ReleaseRoute.MusicBrainzRelease.ExternalId;
            _bindingMusicBrainzReleaseSourceUrl = musicBrainz.ReleaseRoute.MusicBrainzRelease.SourceUrl;
            _bindingMusicBrainzReleaseMbid = musicBrainz.MusicBrainzRow.ReleaseMbid;
            _bindingMusicBrainzMediumPosition = musicBrainz.MusicBrainzRow.MediumPosition;
            _bindingMusicBrainzTrackMbid = musicBrainz.MusicBrainzRow.TrackMbid;
            return true;
        }, _ =>
        {
            _bindingRecordingExternalId = null;
            _bindingRecordingSourceUrl = null;
            _bindingMusicBrainzReleaseExternalId = null;
            _bindingMusicBrainzReleaseSourceUrl = null;
            _bindingMusicBrainzReleaseMbid = null;
            _bindingMusicBrainzMediumPosition = null;
            _bindingMusicBrainzTrackMbid = null;
            return true;
        });
        _bindingPromoteLinkedTargetConfirmed = binding.PromoteLinkedTargetConfirmed;
        _ = binding.ReleaseRoute.DiscogsRelease.Match(
            source =>
            {
                _bindingDiscogsReleaseExternalId = source.ExternalId;
                _bindingDiscogsReleaseSourceUrl = source.SourceUrl;
                return true;
            },
            () =>
            {
                _bindingDiscogsReleaseExternalId = null;
                _bindingDiscogsReleaseSourceUrl = null;
                return true;
            });
        _ = binding.DiscogsRow.Match(
            row =>
            {
                _bindingDiscogsRowReleaseId = row.ReleaseId;
                _bindingDiscogsRowOrdinal = row.RowOrdinal;
                _bindingDiscogsRowPosition = row.Position;
                _bindingDiscogsRowFingerprint = row.Fingerprint;
                return true;
            },
            () =>
            {
                _bindingDiscogsRowReleaseId = null;
                _bindingDiscogsRowOrdinal = null;
                _bindingDiscogsRowPosition = null;
                _bindingDiscogsRowFingerprint = null;
                return true;
            });
    }
}
