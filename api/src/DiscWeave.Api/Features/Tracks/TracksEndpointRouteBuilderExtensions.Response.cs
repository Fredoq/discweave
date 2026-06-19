using DiscWeave.Api.Features.Credits;
using DiscWeave.Api.Features.ExternalSources;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace DiscWeave.Api.Features.Tracks;

public static partial class TracksEndpointRouteBuilderExtensions
{
    private static async Task<TrackResponse> ToTrackResponseAsync(
        Track track,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<TrackResponse> responses = await ToTrackResponsesAsync([track], context, collectionId, cancellationToken);
        return responses[0];
    }

    private static async Task<IReadOnlyList<TrackResponse>> ToTrackResponsesAsync(
        Track[] tracks,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        if (tracks.Length == 0)
        {
            return [];
        }

        TrackId[] trackIds = [.. tracks.Select(track => track.Id).Distinct()];
        Credit[] trackCredits = await LoadTrackCreditsAsync(context, collectionId, trackIds, cancellationToken);
        Release[] appearanceReleases = await LoadAppearanceReleasesAsync(context, collectionId, trackIds, cancellationToken);
        ReleaseId[] appearanceReleaseIds = [.. appearanceReleases.Select(release => release.Id).Distinct()];
        Credit[] releaseCredits = await LoadReleaseCreditsAsync(context, collectionId, appearanceReleaseIds, cancellationToken);
        ArtistId[] artistIds =
        [
            .. trackCredits
                .Concat(releaseCredits)
                .Select(credit => credit.Contributor.ArtistId)
                .Distinct()
        ];
        Dictionary<ArtistId, Artist> artistsById = await LoadArtistsByIdAsync(context, collectionId, artistIds, cancellationToken);
        LabelId[] labelIds = [.. appearanceReleases.SelectMany(release => release.Labels).Select(label => label.LabelId).Distinct()];
        Dictionary<LabelId, Label> labelsById = await LoadLabelsByIdAsync(context, collectionId, labelIds, cancellationToken);
        Dictionary<TrackId, TrackDigitalFileResponse[]> digitalFilesByTrackId = await LoadDigitalFilesByTrackIdAsync(
            context,
            collectionId,
            appearanceReleases,
            trackIds,
            cancellationToken);

        return
        [
            .. tracks.Select(track => ToTrackResponse(
                track,
                trackCredits,
                appearanceReleases,
                releaseCredits,
                artistsById,
                labelsById,
                digitalFilesByTrackId))
        ];
    }

    private static async Task<Credit[]> LoadTrackCreditsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        TrackId[] trackIds,
        CancellationToken cancellationToken)
    {
        return trackIds.Length == 0
            ? []
            :
            [
                .. (await context.Credits.AsNoTracking()
            .Where(credit =>
                credit.CollectionId == collectionId)
            .Where(HasAnyTargetTrackId(trackIds))
            .ToArrayAsync(cancellationToken))
            .OrderBy(credit => credit.Contributor.ArtistId.Value)
            .ThenBy(credit => CreditMapper.ToRoleCode(credit.Role))
            ];
    }

    private static async Task<Release[]> LoadAppearanceReleasesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        TrackId[] trackIds,
        CancellationToken cancellationToken)
    {
        return trackIds.Length == 0
            ? []
            : await context.Releases.AsNoTracking()
                .Where(release =>
                    release.CollectionId == collectionId &&
                    release.Tracklist.Any(releaseTrack => trackIds.Contains(releaseTrack.TrackId)))
                .ToArrayAsync(cancellationToken);
    }

    private static async Task<Credit[]> LoadReleaseCreditsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseId[] releaseIds,
        CancellationToken cancellationToken)
    {
        return releaseIds.Length == 0
            ? []
            :
            [
                .. (await context.Credits.AsNoTracking()
                .Where(credit =>
                    credit.CollectionId == collectionId)
                .Where(HasAnyTargetReleaseId(releaseIds))
                .ToArrayAsync(cancellationToken))
                .OrderBy(credit => credit.Contributor.ArtistId.Value)
                .ThenBy(credit => CreditMapper.ToRoleCode(credit.Role))
            ];
    }

    private static async Task<Dictionary<ArtistId, Artist>> LoadArtistsByIdAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ArtistId[] artistIds,
        CancellationToken cancellationToken)
    {
        return artistIds.Length == 0
            ? []
            : await context.Artists.AsNoTracking()
                .Where(artist => artist.CollectionId == collectionId && artistIds.Contains(artist.Id))
                .ToDictionaryAsync(artist => artist.Id, cancellationToken);
    }

    private static async Task<Dictionary<LabelId, Label>> LoadLabelsByIdAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        LabelId[] labelIds,
        CancellationToken cancellationToken)
    {
        return labelIds.Length == 0
            ? []
            : await context.Labels.AsNoTracking()
                .Where(label => label.CollectionId == collectionId && labelIds.Contains(label.Id))
                .ToDictionaryAsync(label => label.Id, cancellationToken);
    }

    private static async Task<Dictionary<TrackId, TrackDigitalFileResponse[]>> LoadDigitalFilesByTrackIdAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Release[] appearanceReleases,
        TrackId[] trackIds,
        CancellationToken cancellationToken)
    {
        if (appearanceReleases.Length == 0 || trackIds.Length == 0)
        {
            return [];
        }

        TrackDigitalFileContext[] releaseTrackContexts =
        [
            .. appearanceReleases.SelectMany(release => release.Tracklist
                .Where(releaseTrack => trackIds.Contains(releaseTrack.TrackId))
                .Select(releaseTrack => new TrackDigitalFileContext(release, releaseTrack)))
        ];
        if (releaseTrackContexts.Length == 0)
        {
            return [];
        }

        ReleaseTrackId[] releaseTrackIds = [.. releaseTrackContexts.Select(contextRow => contextRow.ReleaseTrack.Id).Distinct()];
        DigitalTrackFileLink[] links = await context.DigitalTrackFileLinks.AsNoTracking()
            .Where(link => link.CollectionId == collectionId && releaseTrackIds.Contains(link.ReleaseTrackId))
            .ToArrayAsync(cancellationToken);
        if (links.Length == 0)
        {
            return [];
        }

        LocalAudioFileId[] localAudioFileIds = [.. links.Select(link => link.LocalAudioFileId).Distinct()];
        Dictionary<LocalAudioFileId, LocalAudioFile> filesById = await context.LocalAudioFiles.AsNoTracking()
            .Where(file => file.CollectionId == collectionId && localAudioFileIds.Contains(file.Id))
            .ToDictionaryAsync(file => file.Id, cancellationToken);
        Dictionary<ReleaseTrackId, TrackDigitalFileContext> contextsByReleaseTrackId = releaseTrackContexts
            .ToDictionary(contextRow => contextRow.ReleaseTrack.Id);

        var responsesByTrackId = new Dictionary<TrackId, List<TrackDigitalFileResponse>>();
        foreach (DigitalTrackFileLink link in links)
        {
            if (!filesById.TryGetValue(link.LocalAudioFileId, out LocalAudioFile? file) ||
                !contextsByReleaseTrackId.TryGetValue(link.ReleaseTrackId, out TrackDigitalFileContext? contextRow))
            {
                continue;
            }

            TrackId trackId = contextRow.ReleaseTrack.TrackId;
            if (!responsesByTrackId.TryGetValue(trackId, out List<TrackDigitalFileResponse>? responses))
            {
                responses = [];
                responsesByTrackId[trackId] = responses;
            }

            responses.Add(ToTrackDigitalFileResponse(link, contextRow.Release, contextRow.ReleaseTrack, file));
        }

        return responsesByTrackId.ToDictionary(
            pair => pair.Key,
            pair => pair.Value
                .OrderBy(response => response.ReleaseTitle, StringComparer.OrdinalIgnoreCase)
                .ThenBy(response => response.Position)
                .ThenBy(response => response.Path, StringComparer.OrdinalIgnoreCase)
                .ToArray());
    }

    private static TrackResponse ToTrackResponse(
        Track track,
        IReadOnlyList<Credit> allTrackCredits,
        IReadOnlyList<Release> allAppearanceReleases,
        IReadOnlyList<Credit> allReleaseCredits,
        Dictionary<ArtistId, Artist> artistsById,
        Dictionary<LabelId, Label> labelsById,
        Dictionary<TrackId, TrackDigitalFileResponse[]> digitalFilesByTrackId)
    {
        Credit[] trackCredits =
        [
            .. allTrackCredits
                .Where(credit => credit.Target is TrackCreditTarget target && target.TrackId == track.Id)
        ];
        Release[] appearanceReleases =
        [
            .. allAppearanceReleases
                .Where(release => release.Tracklist.Any(releaseTrack => releaseTrack.TrackId == track.Id))
        ];
        ReleaseId[] appearanceReleaseIds = [.. appearanceReleases.Select(release => release.Id).Distinct()];
        Credit[] releaseCredits =
        [
            .. allReleaseCredits
                .Where(credit => credit.Target is ReleaseCreditTarget target && appearanceReleaseIds.Contains(target.ReleaseId))
        ];

        return new TrackResponse(
            track.Id.Value,
            track.Title,
            ToDurationSeconds(track),
            [.. track.Cataloging.Genres.Select(genre => genre.Name)],
            [.. track.Cataloging.Tags.Select(tag => tag.Name)],
            ExternalSourceReferenceMapper.ToResponses(track.ExternalSources),
            [.. trackCredits.Select(credit => ToTrackCreditResponse(credit, artistsById))],
            [.. appearanceReleases
                .SelectMany(release => release.Tracklist
                    .Where(releaseTrack => releaseTrack.TrackId == track.Id)
                    .Select(releaseTrack => ToReleaseAppearanceResponse(release, releaseTrack, track, releaseCredits, artistsById, labelsById)))
                .OrderBy(appearance => appearance.ReleaseTitle)
                .ThenBy(appearance => appearance.Position)],
            digitalFilesByTrackId.TryGetValue(track.Id, out TrackDigitalFileResponse[]? digitalFiles) ? digitalFiles : []);
    }

    private static TrackDigitalFileResponse ToTrackDigitalFileResponse(
        DigitalTrackFileLink link,
        Release release,
        ReleaseTrack releaseTrack,
        LocalAudioFile file)
    {
        return new TrackDigitalFileResponse(
            link.Id.Value,
            file.Id.Value,
            link.DigitalOwnedItemId.Value,
            release.Id.Value,
            release.Summary.Title,
            releaseTrack.Id.Value,
            releaseTrack.Position.Number,
            OptionalString(releaseTrack.Position.Disc),
            OptionalString(releaseTrack.Position.Side),
            file.Path.Value,
            OptionalAudioFormat(file.Format),
            OptionalString(file.Codec),
            OptionalAudioQuality(file.Quality),
            OptionalLong(file.SizeBytes),
            OptionalDateTimeOffset(file.ModifiedAt),
            OptionalString(file.ContentHash),
            OptionalDurationSeconds(file.Duration),
            OptionalInt(file.BitrateKbps),
            OptionalInt(file.SampleRateHz),
            OptionalInt(file.Channels));
    }

    private static Expression<Func<Credit, bool>> HasAnyTargetReleaseId(IReadOnlyCollection<ReleaseId> releaseIds)
    {
        Expression<Func<Credit, ReleaseId?>> targetReleaseId = credit => EF.Property<ReleaseId?>(credit, "_targetReleaseId");
        Expression? body = null;

        foreach (ReleaseId releaseId in releaseIds)
        {
            BinaryExpression targetMatches = Expression.Equal(targetReleaseId.Body, Expression.Constant((ReleaseId?)releaseId, typeof(ReleaseId?)));
            body = body is null ? targetMatches : Expression.OrElse(body, targetMatches);
        }

        return Expression.Lambda<Func<Credit, bool>>(body ?? Expression.Constant(false), targetReleaseId.Parameters);
    }

    private static Expression<Func<Credit, bool>> HasAnyTargetTrackId(IReadOnlyCollection<TrackId> trackIds)
    {
        Expression<Func<Credit, TrackId?>> targetTrackId = credit => EF.Property<TrackId?>(credit, "_targetTrackId");
        Expression? body = null;

        foreach (TrackId trackId in trackIds)
        {
            BinaryExpression targetMatches = Expression.Equal(targetTrackId.Body, Expression.Constant((TrackId?)trackId, typeof(TrackId?)));
            body = body is null ? targetMatches : Expression.OrElse(body, targetMatches);
        }

        return Expression.Lambda<Func<Credit, bool>>(body ?? Expression.Constant(false), targetTrackId.Parameters);
    }

    private static TrackCreditResponse ToTrackCreditResponse(Credit credit, Dictionary<ArtistId, Artist> artistsById)
    {
        ArtistId artistId = credit.Contributor.ArtistId;

        return new TrackCreditResponse(
            artistId.Value,
            artistsById.TryGetValue(artistId, out Artist? artist) ? artist.Name : credit.Contributor.Name,
            CreditMapper.ToRoleCode(credit.Role),
            [.. credit.Roles.Select(CreditMapper.ToRoleCode)]);
    }

    private static TrackReleaseAppearanceResponse ToReleaseAppearanceResponse(
        Release release,
        ReleaseTrack releaseTrack,
        Track track,
        IReadOnlyList<Credit> releaseCredits,
        Dictionary<ArtistId, Artist> artistsById,
        Dictionary<LabelId, Label> labelsById)
    {
        Credit[] credits = [.. releaseCredits.Where(credit => credit.Target is ReleaseCreditTarget target && target.ReleaseId == release.Id)];
        string releaseArtist = release.IsVariousArtists
            ? "Various Artists"
            : FormatReleaseArtists(credits, artistsById);
        ReleaseLabel? releaseLabel = release.Labels.Count > 0 ? release.Labels[0] : null;

        return new TrackReleaseAppearanceResponse(
            release.Id.Value,
            release.Summary.Title,
            releaseArtist,
            ToReleaseYear(release),
            releaseLabel is not null ? FormatLabel(releaseLabel, labelsById) : null,
            releaseTrack.Position.Number,
            OptionalString(releaseTrack.Position.Disc),
            OptionalString(releaseTrack.Position.Side),
            ToDurationSeconds(track));
    }

    private static string? OptionalString(IOptionalValue<string>? value)
    {
        return value is { HasValue: true } ? value.Match(present => present, () => string.Empty) : null;
    }

    private static string FormatReleaseArtists(IReadOnlyList<Credit> releaseCredits, Dictionary<ArtistId, Artist> artistsById)
    {
        string[] artistNames =
        [
            .. releaseCredits
                .Where(credit => credit.Roles.Contains("mainArtist", StringComparer.Ordinal))
                .OrderBy(credit => credit.Contributor.ArtistId.Value)
                .Select(credit => artistsById.TryGetValue(credit.Contributor.ArtistId, out Artist? artist) ? artist.Name : credit.Contributor.Name)
        ];

        return artistNames.Length > 0 ? string.Join(", ", artistNames) : "Unknown artist";
    }

    private static string FormatLabel(ReleaseLabel releaseLabel, Dictionary<LabelId, Label> labelsById)
    {
        return labelsById.TryGetValue(releaseLabel.LabelId, out Label? label)
            ? label.Name
            : "Unknown label";
    }

    private static int? ToDurationSeconds(Track track)
    {
        return track.Details.Duration.HasValue
            ? track.Details.Duration.Match(value => (int)value.TotalSeconds, () => 0)
            : null;
    }

    private static int? ToReleaseYear(Release release)
    {
        return release.Summary.Metadata.Year.HasValue
            ? release.Summary.Metadata.Year.Match(value => value, () => 0)
            : null;
    }

    private static long? OptionalLong(IOptionalValue<long>? value)
    {
        return value is PresentOptionalValue<long> present ? present.Value : null;
    }

    private static int? OptionalInt(IOptionalValue<int>? value)
    {
        return value is PresentOptionalValue<int> present ? present.Value : null;
    }

    private static DateTimeOffset? OptionalDateTimeOffset(IOptionalValue<DateTimeOffset>? value)
    {
        return value is PresentOptionalValue<DateTimeOffset> present ? present.Value : null;
    }

    private static int? OptionalDurationSeconds(IOptionalValue<TimeSpan>? value)
    {
        return value is PresentOptionalValue<TimeSpan> present ? (int)present.Value.TotalSeconds : null;
    }

    private static string? OptionalAudioFormat(IOptionalValue<AudioFileFormat>? value)
    {
        return value is { HasValue: true } ? value.Match(ToAudioFileFormatCode, () => string.Empty) : null;
    }

    private static string? OptionalAudioQuality(IOptionalValue<AudioFileQuality>? value)
    {
        return value is { HasValue: true } ? value.Match(ToAudioFileQualityCode, () => string.Empty) : null;
    }

    private static string ToAudioFileFormatCode(AudioFileFormat format)
    {
        return format switch
        {
            AudioFileFormat.Flac => "flac",
            AudioFileFormat.Mp3 => "mp3",
            AudioFileFormat.Ogg => "ogg",
            AudioFileFormat.Wav => "wav",
            AudioFileFormat.Aiff => "aiff",
            AudioFileFormat.Alac => "alac",
            AudioFileFormat.M4a => "m4a",
            _ => throw new InvalidOperationException("Audio file format is not supported")
        };
    }

    private static string ToAudioFileQualityCode(AudioFileQuality quality)
    {
        return quality switch
        {
            AudioFileQuality.Lossless => "lossless",
            AudioFileQuality.Lossy => "lossy",
            _ => throw new InvalidOperationException("Audio file quality is not supported")
        };
    }

    private sealed record TrackDigitalFileContext(Release Release, ReleaseTrack ReleaseTrack);
}
