using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Imports;

public abstract class SelectedOriginalBinding
{
    private SelectedOriginalBinding(TrackId sourceTrackId, ReleaseImportDraftTrackId draftTrackId, bool confirmed)
    {
        SourceTrackId = sourceTrackId;
        DraftTrackId = draftTrackId;
        PromoteLinkedTargetConfirmed = confirmed;
    }

    public TrackId SourceTrackId { get; }

    public ReleaseImportDraftTrackId DraftTrackId { get; }

    public bool PromoteLinkedTargetConfirmed { get; }

    public abstract ExternalReleaseRoute ReleaseRoute { get; }

    public abstract IOptionalValue<DiscogsReleaseRowLocator> DiscogsRow { get; }

    public abstract IReadOnlyList<ReleaseImportProviderReference> TrackSources { get; }

    public abstract TResult Match<TResult>(Func<MusicBrainz, TResult> musicBrainz, Func<Discogs, TResult> discogs);

    internal abstract SelectedOriginalBinding WithPromoteLinkedTargetConfirmation(bool confirmed);

    internal bool HasSameValueAs(SelectedOriginalBinding other)
    {
        return other is not null &&
            SourceTrackId == other.SourceTrackId && DraftTrackId == other.DraftTrackId &&
            PromoteLinkedTargetConfirmed == other.PromoteLinkedTargetConfirmed &&
            ReleaseRoute.HasSameValueAs(other.ReleaseRoute) &&
            DiscogsRow.Match(left => other.DiscogsRow.Match(left.HasSameValueAs, () => false), () => !other.DiscogsRow.HasValue) &&
            Match(left => other.Match(right => left.RecordingSource.HasSameValueAs(right.RecordingSource) &&
                left.MusicBrainzRow.HasSameValueAs(right.MusicBrainzRow), _ => false),
                _ => other.Match(_ => false, _ => true));
    }

    public static SelectedOriginalBinding CreateDiscogs(TrackId sourceTrackId, ReleaseImportDraftTrackId draftTrackId,
        DiscogsReleaseRowLocator row, bool promoteLinkedTargetConfirmed)
    {
        return new Discogs(sourceTrackId, draftTrackId, row, promoteLinkedTargetConfirmed);
    }

    public static SelectedOriginalBinding CreateMusicBrainz(TrackId sourceTrackId, ReleaseImportDraftTrackId draftTrackId,
        ReleaseImportProviderReference recordingSource, ExternalReleaseRoute releaseRoute,
        MusicBrainzReleaseRowLocator musicBrainzRow, bool promoteLinkedTargetConfirmed)
    {
        ArgumentNullException.ThrowIfNull(releaseRoute);
        return releaseRoute.Match(route => new MusicBrainz(sourceTrackId, draftTrackId, recordingSource, route, musicBrainzRow,
            Optional.Missing<DiscogsReleaseRowLocator>(), promoteLinkedTargetConfirmed),
            _ => throw new DomainException("release_import.musicbrainz_row_release_mismatch", "MusicBrainz row locator must belong to the routed release"));
    }

    public static SelectedOriginalBinding CreateDiscogsBacked(TrackId sourceTrackId, ReleaseImportDraftTrackId draftTrackId,
        ReleaseImportProviderReference recordingSource, ExternalReleaseRoute releaseRoute,
        MusicBrainzReleaseRowLocator musicBrainzRow, DiscogsReleaseRowLocator discogsRow, bool promoteLinkedTargetConfirmed)
    {
        ArgumentNullException.ThrowIfNull(releaseRoute);
        ArgumentNullException.ThrowIfNull(discogsRow);
        return releaseRoute.Match(route => new MusicBrainz(sourceTrackId, draftTrackId, recordingSource, route,
            musicBrainzRow, Optional.From(discogsRow), promoteLinkedTargetConfirmed),
            _ => throw new DomainException("release_import.musicbrainz_row_release_mismatch", "MusicBrainz row locator must belong to the routed release"));
    }

    public sealed class MusicBrainz : SelectedOriginalBinding
    {
        private static void ValidateCommon(
            TrackId sourceTrackId,
            ReleaseImportDraftTrackId draftTrackId,
            ReleaseImportProviderReference recordingSource,
            ExternalReleaseRoute.MusicBrainz releaseRoute,
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

        internal MusicBrainz(TrackId sourceTrackId, ReleaseImportDraftTrackId draftTrackId,
            ReleaseImportProviderReference recordingSource, ExternalReleaseRoute.MusicBrainz releaseRoute,
            MusicBrainzReleaseRowLocator musicBrainzRow, IOptionalValue<DiscogsReleaseRowLocator> discogsRow, bool confirmed)
            : base(sourceTrackId, draftTrackId, confirmed)
        {
            ValidateCommon(sourceTrackId, draftTrackId, recordingSource, releaseRoute, musicBrainzRow);
            ArgumentNullException.ThrowIfNull(discogsRow);
            _ = discogsRow.Match(row =>
            {
                ReleaseImportProviderReference release = releaseRoute.DiscogsRelease.Match(value => value,
                    () => throw new DomainException("release_import.discogs_release_required", "Discogs-backed bindings require a Discogs release route"));
                return string.Equals(release.ExternalId, row.ReleaseId, StringComparison.Ordinal)
                    ? true
                    : throw new DomainException("release_import.discogs_row_release_mismatch", "Discogs row locator must belong to the routed release");
            }, () => releaseRoute.DiscogsRelease.Match(
                _ => throw new DomainException("release_import.discogs_row_required", "Discogs-backed release routes require a Discogs row locator"), () => true));
            RecordingSource = recordingSource;
            ReleaseRoute = releaseRoute;
            MusicBrainzRow = musicBrainzRow;
            DiscogsRow = discogsRow;
        }

        public ReleaseImportProviderReference RecordingSource { get; }

        public override ExternalReleaseRoute.MusicBrainz ReleaseRoute { get; }

        public MusicBrainzReleaseRowLocator MusicBrainzRow { get; }

        public override IOptionalValue<DiscogsReleaseRowLocator> DiscogsRow { get; }

        public override IReadOnlyList<ReleaseImportProviderReference> TrackSources =>
            [RecordingSource, ReleaseImportProviderReference.Create("musicbrainz", "track", MusicBrainzRow.TrackMbid,
                $"https://musicbrainz.org/track/{MusicBrainzRow.TrackMbid}")];

        public override TResult Match<TResult>(Func<MusicBrainz, TResult> musicBrainz, Func<Discogs, TResult> discogs)
        {
            ArgumentNullException.ThrowIfNull(musicBrainz);
            ArgumentNullException.ThrowIfNull(discogs);
            return musicBrainz(this);
        }

        internal override SelectedOriginalBinding WithPromoteLinkedTargetConfirmation(bool confirmed)
        {
            return new MusicBrainz(SourceTrackId, DraftTrackId, RecordingSource, ReleaseRoute, MusicBrainzRow, DiscogsRow, confirmed);
        }
    }

    public sealed class Discogs : SelectedOriginalBinding
    {
        internal Discogs(TrackId sourceTrackId, ReleaseImportDraftTrackId draftTrackId, DiscogsReleaseRowLocator row, bool confirmed)
            : base(sourceTrackId, draftTrackId, confirmed)
        {
            ArgumentNullException.ThrowIfNull(row);
            if (sourceTrackId.Value == Guid.Empty || draftTrackId.Value == Guid.Empty)
            {
                throw new DomainException("release_import.source_track_required", "Source and draft track IDs are required");
            }

            Row = row;
            ReleaseRoute = new ExternalReleaseRoute.Discogs(ReleaseImportProviderReference.Create(
                "discogs", "release", row.ReleaseId, $"https://www.discogs.com/release/{row.ReleaseId}"));
        }

        public DiscogsReleaseRowLocator Row { get; }

        public override ExternalReleaseRoute.Discogs ReleaseRoute { get; }

        public override IOptionalValue<DiscogsReleaseRowLocator> DiscogsRow => Optional.From(Row);

        public override IReadOnlyList<ReleaseImportProviderReference> TrackSources => [Row.ToTrackSource()];

        public override TResult Match<TResult>(Func<MusicBrainz, TResult> musicBrainz, Func<Discogs, TResult> discogs)
        {
            ArgumentNullException.ThrowIfNull(musicBrainz);
            ArgumentNullException.ThrowIfNull(discogs);
            return discogs(this);
        }

        internal override SelectedOriginalBinding WithPromoteLinkedTargetConfirmation(bool confirmed)
        {
            return new Discogs(SourceTrackId, DraftTrackId, Row, confirmed);
        }
    }
}
