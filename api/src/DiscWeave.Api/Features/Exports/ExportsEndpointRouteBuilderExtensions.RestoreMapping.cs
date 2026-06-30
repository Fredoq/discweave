using System.Globalization;
using DiscWeave.Api.Features.OwnedItems;
using DiscWeave.Api.Features.Playlists;
using DiscWeave.Api.Features.Releases;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.Playlists;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Api.Features.Exports;

public static partial class ExportsEndpointRouteBuilderExtensions
{
    private static ReleaseMetadata ToReleaseMetadata(ReleaseResponse release)
    {
        ReleaseMetadata metadata = ReleaseMetadata.Empty.WithType(release.Type);

        if (release.Year is { } year)
        {
            metadata = metadata.WithReleaseYear(year);
        }

        if (!string.IsNullOrWhiteSpace(release.ReleaseDate))
        {
            if (!DateOnly.TryParseExact(release.ReleaseDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateOnly releaseDate))
            {
                throw new DomainException("release.release_date_invalid", "Release date is invalid");
            }

            metadata = metadata.WithReleaseDate(releaseDate);
        }

        return release.CoverImage is { } coverImage
            ? metadata.WithCoverImage(CoverImage.FromStoredMetadata(
                coverImage.Url,
                coverImage.ContentType,
                coverImage.OriginalFileName,
                coverImage.SizeBytes,
                coverImage.SourceType))
            : metadata;
    }

    private static Cataloging ToCataloging(IReadOnlyList<string> genres, IReadOnlyList<string> tags)
    {
        Cataloging cataloging = Cataloging.Empty;
        foreach (string genre in genres)
        {
            cataloging = cataloging.WithGenre(Genre.FromName(genre));
        }

        foreach (string tag in tags)
        {
            cataloging = cataloging.WithTag(Tag.FromName(tag));
        }

        return cataloging;
    }

    private static ReleaseLabel ToReleaseLabel(ReleaseLabelResponse label)
    {
        return ReleaseLabel.Create(
            new LabelId(label.LabelId.GetValueOrDefault()),
            OptionalText(label.CatalogNumber),
            label.HasNoCatalogNumber);
    }

    private static ReleaseTrack ToReleaseTrack(ReleaseTracklistItemResponse track)
    {
        ReleaseTrackId releaseTrackId = track.ReleaseTrackId.HasValue ? new ReleaseTrackId(track.ReleaseTrackId.Value) : ReleaseTrackId.New();
        var position = TrackPosition.FromNumber(track.Position, track.Disc ?? string.Empty, track.Side ?? string.Empty);
        return track.IsReleaseOnly || track.TrackId is null
            ? ReleaseTrack.CreateReleaseOnly(
                    releaseTrackId,
                    position,
                    track.Title,
                    TrackDetailsFromDuration(track.DurationSeconds))
                .WithArtistCredits(ToReleaseTrackArtistCredits(track.ArtistCredits))
            : ReleaseTrack.Create(
                releaseTrackId,
                new TrackId(track.TrackId.Value),
                position,
                Optional.Missing<string>());
    }

    private static ReleaseTrackArtistCredit[] ToReleaseTrackArtistCredits(
        IReadOnlyList<ReleaseArtistCreditResponse> artistCredits)
    {
        return
        [
            .. artistCredits.Select(credit => ReleaseTrackArtistCredit.Create(
                new ArtistId(credit.ArtistId),
                credit.Roles))
        ];
    }

    private static TrackDetails TrackDetailsFromDuration(int? durationSeconds)
    {
        return durationSeconds is { } seconds
            ? TrackDetails.Empty.WithDuration(TimeSpan.FromSeconds(seconds))
            : TrackDetails.Empty;
    }

    private static IMedium ToMedium(MediumResponse medium)
    {
        return medium.Type switch
        {
            "digital" => ToDigitalFile(medium),
            "vinyl" => VinylRecord.Create(medium.Description),
            "cd" => CompactDisc.Create(medium.DiscCount ?? 1),
            "cassette" => CassetteTape.Create(medium.Description),
            _ => OtherMedium.Create(medium.Description)
        };
    }

    private static DigitalFile ToDigitalFile(MediumResponse medium)
    {
        _ = medium;

        return DigitalFile.Create();
    }

    private static AudioFileFormat ParseAudioFileFormat(string format)
    {
        return format.Trim().ToLowerInvariant() switch
        {
            "flac" => AudioFileFormat.Flac,
            "mp3" => AudioFileFormat.Mp3,
            "ogg" => AudioFileFormat.Ogg,
            "wav" => AudioFileFormat.Wav,
            "aiff" => AudioFileFormat.Aiff,
            "alac" => AudioFileFormat.Alac,
            "m4a" => AudioFileFormat.M4a,
            _ => throw new DomainException("local_audio_file.format_invalid", "Audio file format is invalid")
        };
    }

    private static AudioFileQuality ParseAudioFileQuality(string quality)
    {
        return quality.Trim().ToLowerInvariant() switch
        {
            "lossless" => AudioFileQuality.Lossless,
            "lossy" => AudioFileQuality.Lossy,
            _ => throw new DomainException("local_audio_file.quality_invalid", "Audio file quality is invalid")
        };
    }

    private static CreditTarget ToCreditTarget(string targetType, Guid targetId)
    {
        return targetType switch
        {
            "release" => CreditTarget.ForRelease(new ReleaseId(targetId)),
            "track" => CreditTarget.ForTrack(new TrackId(targetId)),
            _ => throw new DomainException("credit.target_type_invalid", "Credit target type is invalid")
        };
    }

    private static PlaylistEntry ToPlaylistEntry(PlaylistItemResponse entry, int index)
    {
        return entry.Kind switch
        {
            PlaylistEntry.ReleaseKind => PlaylistEntry.ForRelease(index, new ReleaseId(entry.Id)),
            PlaylistEntry.TrackKind => PlaylistEntry.ForTrack(index, new TrackId(entry.Id)),
            _ => throw new DomainException("playlist.entry_kind_invalid", "Playlist entry kind is invalid")
        };
    }

    private static PlaylistEntry[] ToPlaylistEntries(IReadOnlyList<PlaylistItemResponse> entries)
    {
        var restored = new List<PlaylistEntry>(entries.Count);
        for (int index = 0; index < entries.Count; index++)
        {
            restored.Add(ToPlaylistEntry(entries[index], index));
        }

        return [.. restored];
    }

    private static ArtistRelationPeriod ToRelationPeriod(int? startYear, int? endYear)
    {
        return (startYear, endYear) switch
        {
            ({ } start, { } end) => ArtistRelationPeriod.FromYears(start, end),
            ({ } start, null) => ArtistRelationPeriod.StartingAt(start),
            (null, { } end) => ArtistRelationPeriod.EndingAt(end),
            _ => throw new DomainException("relation_period.required", "Relation period is required")
        };
    }

    private static IOptionalValue<string> OptionalText(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? Optional.Missing<string>() : Optional.From(value.Trim());
    }

    private static IOptionalValue<int> OptionalYear(int? value)
    {
        return value.HasValue ? Optional.From(value.Value) : Optional.Missing<int>();
    }

    private sealed class ArtistLookup
    {
        private readonly IReadOnlyDictionary<ArtistId, Artist> _artists;

        public ArtistLookup(IReadOnlyDictionary<ArtistId, Artist> artists)
        {
            _artists = artists;
        }

        public Artist Get(ArtistId artistId)
        {
            return _artists.TryGetValue(artistId, out Artist? artist)
                ? artist
                : throw new DomainException("artist.not_found", "Artist was not found");
        }
    }
}
