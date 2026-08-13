using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Imports;

#pragma warning disable CS8618
public sealed class SelectedOriginalBinding
{
    private SelectedOriginalBinding()
    {
    }

    private SelectedOriginalBinding(
        TrackId sourceTrackId,
        ReleaseImportDraftTrackId draftTrackId,
        ReleaseImportProviderReference recordingSource,
        ExternalReleaseRoute releaseRoute,
        MusicBrainzReleaseRowLocator musicBrainzRow,
        IOptionalValue<DiscogsReleaseRowLocator> discogsRow,
        bool promoteLinkedTargetConfirmed)
    {
        SourceTrackId = sourceTrackId;
        DraftTrackId = draftTrackId;
        RecordingSource = recordingSource;
        ReleaseRoute = releaseRoute;
        MusicBrainzRow = musicBrainzRow;
        DiscogsRow = discogsRow;
        PromoteLinkedTargetConfirmed = promoteLinkedTargetConfirmed;
    }

    public TrackId SourceTrackId { get; private init; }

    public ReleaseImportDraftTrackId DraftTrackId { get; private init; }

    public ReleaseImportProviderReference RecordingSource { get; private init; }

    public ExternalReleaseRoute ReleaseRoute { get; private init; }

    public MusicBrainzReleaseRowLocator MusicBrainzRow { get; private init; }

    public IOptionalValue<DiscogsReleaseRowLocator> DiscogsRow { get; private init; } =
        Optional.Missing<DiscogsReleaseRowLocator>();

    public bool PromoteLinkedTargetConfirmed { get; private init; }

    internal SelectedOriginalBinding WithPromoteLinkedTargetConfirmation(bool confirmed)
    {
        return new SelectedOriginalBinding(
            SourceTrackId,
            DraftTrackId,
            RecordingSource,
            ReleaseRoute,
            MusicBrainzRow,
            DiscogsRow,
            confirmed);
    }

    internal bool HasSameValueAs(SelectedOriginalBinding other)
    {
        return other is not null &&
            SourceTrackId == other.SourceTrackId &&
            DraftTrackId == other.DraftTrackId &&
            RecordingSource.HasSameValueAs(other.RecordingSource) &&
            ReleaseRoute.HasSameValueAs(other.ReleaseRoute) &&
            MusicBrainzRow.HasSameValueAs(other.MusicBrainzRow) &&
            DiscogsRow.Match(
                left => other.DiscogsRow.Match(left.HasSameValueAs, () => false),
                () => !other.DiscogsRow.HasValue) &&
            PromoteLinkedTargetConfirmed == other.PromoteLinkedTargetConfirmed;
    }

    public static SelectedOriginalBinding CreateMusicBrainz(
        TrackId sourceTrackId,
        ReleaseImportDraftTrackId draftTrackId,
        ReleaseImportProviderReference recordingSource,
        ExternalReleaseRoute releaseRoute,
        MusicBrainzReleaseRowLocator musicBrainzRow,
        bool promoteLinkedTargetConfirmed)
    {
        ValidateCommon(sourceTrackId, draftTrackId, recordingSource, releaseRoute, musicBrainzRow);
        _ = releaseRoute.DiscogsRelease.Match(
            _ => throw new DomainException(
                "release_import.discogs_row_required",
                "Discogs-backed release routes require a Discogs row locator"),
            () => true);

        return new SelectedOriginalBinding(
            sourceTrackId,
            draftTrackId,
            recordingSource,
            releaseRoute,
            musicBrainzRow,
            Optional.Missing<DiscogsReleaseRowLocator>(),
            promoteLinkedTargetConfirmed);
    }

    public static SelectedOriginalBinding CreateDiscogsBacked(
        TrackId sourceTrackId,
        ReleaseImportDraftTrackId draftTrackId,
        ReleaseImportProviderReference recordingSource,
        ExternalReleaseRoute releaseRoute,
        MusicBrainzReleaseRowLocator musicBrainzRow,
        DiscogsReleaseRowLocator discogsRow,
        bool promoteLinkedTargetConfirmed)
    {
        ValidateCommon(sourceTrackId, draftTrackId, recordingSource, releaseRoute, musicBrainzRow);
        ArgumentNullException.ThrowIfNull(discogsRow);
        ReleaseImportProviderReference routeRelease = releaseRoute.DiscogsRelease.Match(
            value => value,
            () => throw new DomainException(
                "release_import.discogs_release_required",
                "Discogs-backed bindings require a Discogs release route"));
        _ = string.Equals(routeRelease.ExternalId, discogsRow.ReleaseId, StringComparison.Ordinal)
            ? true
            : throw new DomainException(
                "release_import.discogs_row_release_mismatch",
                "Discogs row locator must belong to the routed release");

        return new SelectedOriginalBinding(
            sourceTrackId,
            draftTrackId,
            recordingSource,
            releaseRoute,
            musicBrainzRow,
            Optional.From(discogsRow),
            promoteLinkedTargetConfirmed);
    }

    private static void ValidateCommon(
        TrackId sourceTrackId,
        ReleaseImportDraftTrackId draftTrackId,
        ReleaseImportProviderReference recordingSource,
        ExternalReleaseRoute releaseRoute,
        MusicBrainzReleaseRowLocator musicBrainzRow)
    {
        if (sourceTrackId.Value == Guid.Empty)
        {
            throw new DomainException("release_import.source_track_required", "Source track ID is required");
        }

        if (draftTrackId.Value == Guid.Empty)
        {
            throw new DomainException("release_import.draft_track_required", "Draft track ID is required");
        }

        ArgumentNullException.ThrowIfNull(recordingSource);
        ArgumentNullException.ThrowIfNull(releaseRoute);
        ArgumentNullException.ThrowIfNull(musicBrainzRow);
        if (!string.Equals(recordingSource.ProviderCode, "musicbrainz", StringComparison.Ordinal) ||
            !string.Equals(recordingSource.ResourceType, "recording", StringComparison.Ordinal) ||
            !Guid.TryParseExact(recordingSource.ExternalId, "D", out Guid recordingMbid) ||
            recordingMbid == Guid.Empty)
        {
            throw new DomainException(
                "release_import.recording_source_invalid",
                "Selected original binding requires a MusicBrainz Recording reference");
        }

        if (!string.Equals(
                releaseRoute.MusicBrainzRelease.ExternalId,
                musicBrainzRow.ReleaseMbid,
                StringComparison.Ordinal))
        {
            throw new DomainException(
                "release_import.musicbrainz_row_release_mismatch",
                "MusicBrainz row locator must belong to the routed release");
        }
    }
}
#pragma warning restore CS8618
