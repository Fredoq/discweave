using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Infrastructure.Persistence.Queries;

public sealed partial class LocalOriginalCandidateDataSource
{
    private const string MainArtistRoleCode = "mainArtist";

    private static LocalOriginalCandidateSnapshot CreateSnapshot(
        CollectionId collectionId,
        Track source,
        IReadOnlyList<Track> tracks,
        IReadOnlyList<TrackRelation> relations,
        IReadOnlyList<Release> releases,
        IReadOnlyList<Credit> credits,
        IReadOnlyList<Artist> artists,
        IReadOnlyList<string> enabledRelationTypeCodes,
        IReadOnlyList<TrackRelationParserRule> parserRules)
    {
        var artistsById = artists.ToDictionary(
            artist => artist.Id);
        IReadOnlyList<LocalOriginalCandidateSnapshot.PrimaryArtistFact>
            primaryArtists = PrimaryArtists(
                collectionId,
                tracks,
                releases,
                credits,
                artistsById);

        return new LocalOriginalCandidateSnapshot
        {
            Source = ToSource(source),
            Candidates =
            [
                .. tracks.Select(ToCandidate)
            ],
            StackTracks =
            [
                .. tracks.Select(ToStackTrack)
            ],
            StackRelations =
            [
                .. relations.Select(ToStackRelation)
            ],
            Appearances = Appearances(collectionId, releases),
            PrimaryArtists = primaryArtists,
            Credits = TrackCredits(collectionId, credits, artistsById),
            EnabledStackRelationTypeCodes = enabledRelationTypeCodes,
            ParserRules =
            [
                .. parserRules.Select(ToParserRule)
            ]
        };
    }

    private static LocalOriginalCandidateSnapshot.SourceTrackFact ToSource(
        Track track)
    {
        return new LocalOriginalCandidateSnapshot.SourceTrackFact
        {
            CollectionId = track.CollectionId,
            TrackId = track.Id,
            Title = track.Title,
            Duration = Duration(track),
            VersionYear = VersionYear(track),
            IsOriginal = track.Metadata.IsOriginal,
            RecordingSource = RecordingSource(track)
        };
    }

    private static LocalOriginalCandidateSnapshot.CandidateTrackFact
        ToCandidate(Track track)
    {
        return new LocalOriginalCandidateSnapshot.CandidateTrackFact
        {
            CollectionId = track.CollectionId,
            TrackId = track.Id,
            Title = track.Title,
            Duration = Duration(track),
            VersionYear = VersionYear(track),
            IsOriginal = track.Metadata.IsOriginal,
            RecordingSource = RecordingSource(track)
        };
    }

    private static LocalOriginalCandidateSnapshot.StackTrackFact ToStackTrack(
        Track track)
    {
        return new LocalOriginalCandidateSnapshot.StackTrackFact
        {
            CollectionId = track.CollectionId,
            TrackId = track.Id,
            Title = track.Title,
            IsOriginal = track.Metadata.IsOriginal
        };
    }

    private static LocalOriginalCandidateSnapshot.StackRelationFact
        ToStackRelation(TrackRelation relation)
    {
        return new LocalOriginalCandidateSnapshot.StackRelationFact
        {
            CollectionId = relation.CollectionId,
            SourceTrackId = relation.SourceTrackId,
            TargetTrackId = relation.TargetTrackId,
            RelationTypeCode = relation.RelationType
        };
    }

    private static IReadOnlyList<LocalOriginalCandidateSnapshot.AppearanceFact>
        Appearances(
            CollectionId collectionId,
            IReadOnlyList<Release> releases)
    {
        return
        [
            .. releases
                .SelectMany(release => release.Tracklist
                    .Where(item => item.TrackId.HasValue)
                    .Select(item =>
                        new LocalOriginalCandidateSnapshot.AppearanceFact
                        {
                            CollectionId = collectionId,
                            TrackId = item.TrackId!.Value,
                            ReleaseDate = ReleaseDate(release),
                            ReleaseYear = ReleaseYear(release)
                        }))
                .OrderBy(item => item.TrackId.Value)
                .ThenBy(item => item.ReleaseDate)
                .ThenBy(item => item.ReleaseYear)
        ];
    }

    private static IReadOnlyList<LocalOriginalCandidateSnapshot.CreditFact>
        TrackCredits(
            CollectionId collectionId,
            IReadOnlyList<Credit> credits,
            IReadOnlyDictionary<ArtistId, Artist> artistsById)
    {
        return
        [
            .. credits
                .SelectMany(credit => credit.Target is TrackCreditTarget target
                    ? credit.Roles.Select(role =>
                        new LocalOriginalCandidateSnapshot.CreditFact
                        {
                            CollectionId = collectionId,
                            TrackId = target.TrackId,
                            RoleCode = role,
                            ContributorName = ArtistName(
                                credit,
                                artistsById)
                        })
                    : [])
                .OrderBy(item => item.TrackId.Value)
                .ThenBy(item => item.RoleCode, StringComparer.Ordinal)
                .ThenBy(
                    item => item.ContributorName,
                    StringComparer.OrdinalIgnoreCase)
        ];
    }

    private static LocalOriginalCandidateSnapshot.ParserRuleFact ToParserRule(
        TrackRelationParserRule rule)
    {
        return new LocalOriginalCandidateSnapshot.ParserRuleFact
        {
            RuleId = rule.Id,
            RelationTypeCode = rule.RelationTypeCode,
            Alias = rule.Alias,
            MatchMode = rule.MatchMode,
            Confidence = rule.Confidence,
            Direction = rule.Direction,
            SortOrder = rule.SortOrder,
            IsActive = rule.IsActive
        };
    }

    private static TimeSpan? Duration(Track track)
    {
        return track.Details.Duration is PresentOptionalValue<TimeSpan> duration
            ? duration.Value
            : null;
    }

    private static int? VersionYear(Track track)
    {
        return track.Metadata.VersionYear is PresentOptionalValue<int> year
            ? year.Value
            : null;
    }

    private static DateOnly? ReleaseDate(Release release)
    {
        return release.Summary.Metadata.ReleaseDate
            is PresentOptionalValue<DateOnly> releaseDate
            ? releaseDate.Value
            : null;
    }

    private static int? ReleaseYear(Release release)
    {
        return release.Summary.Metadata.Year is PresentOptionalValue<int> year
            ? year.Value
            : null;
    }

    private static ExternalMetadataSource? RecordingSource(Track track)
    {
        ExternalSourceReference? source = track.ExternalSources
            .Where(item =>
                string.Equals(
                    item.ProviderName,
                    "musicbrainz",
                    StringComparison.OrdinalIgnoreCase)
                && string.Equals(
                    item.ResourceType,
                    "recording",
                    StringComparison.OrdinalIgnoreCase))
            .OrderBy(item => item.ExternalId, StringComparer.Ordinal)
            .FirstOrDefault();
        return source is null
            ? null
            : new ExternalMetadataSource(
                source.ProviderName,
                source.ResourceType,
                source.ExternalId,
                source.SourceUrl,
                "MusicBrainz");
    }

    private static string ArtistName(
        Credit credit,
        IReadOnlyDictionary<ArtistId, Artist> artistsById)
    {
        return artistsById.TryGetValue(
            credit.Contributor.ArtistId,
            out Artist? artist)
            ? artist.Name
            : credit.Contributor.Name;
    }
}
