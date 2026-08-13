using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed partial class LocalOriginalCandidateServiceTests
{
    private readonly SqliteFixture _sqlite;

    public LocalOriginalCandidateServiceTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    private static LocalOriginalCandidateService CreateService(
        LocalOriginalCandidateSnapshot snapshot)
    {
        return new LocalOriginalCandidateService(
            new FakeLocalOriginalCandidateDataSource(snapshot));
    }

    private static LocalOriginalCandidateSnapshot NotFoundSnapshot()
    {
        return new LocalOriginalCandidateSnapshot
        {
            Source = null,
            Candidates = [],
            StackTracks = [],
            StackRelations = [],
            Appearances = [],
            PrimaryArtists = [],
            Credits = [],
            EnabledStackRelationTypeCodes = [],
            ParserRules = []
        };
    }

    private static LocalOriginalCandidateSnapshot Snapshot(
        CollectionId collectionId,
        LocalOriginalCandidateSnapshot.SourceTrackFact source)
    {
        return new LocalOriginalCandidateSnapshot
        {
            Source = source,
            Candidates = [],
            StackTracks = [StackTrack(source)],
            StackRelations = [],
            Appearances =
            [
                Appearance(collectionId, source.TrackId, 2005)
            ],
            PrimaryArtists =
            [
                PrimaryArtist(collectionId, source.TrackId, "Candidate Artist")
            ],
            Credits = [],
            EnabledStackRelationTypeCodes = ["remixOf", "versionOf"],
            ParserRules =
            [
                ParserRule("remixOf", "Remix")
            ]
        };
    }

    private static LocalOriginalCandidateSnapshot CandidateSnapshot(
        CollectionId collectionId,
        LocalOriginalCandidateSnapshot.SourceTrackFact source,
        params LocalOriginalCandidateSnapshot.CandidateTrackFact[] candidates)
    {
        return Snapshot(collectionId, source) with
        {
            Candidates = candidates,
            StackTracks =
            [
                StackTrack(source),
                .. candidates
                    .Where(candidate => candidate.CollectionId == collectionId)
                    .Select(StackTrack)
            ],
            Appearances =
            [
                Appearance(collectionId, source.TrackId, 2005),
                .. candidates
                    .Where(candidate => candidate.CollectionId == collectionId)
                    .Select(candidate => Appearance(
                        collectionId,
                        candidate.TrackId,
                        1999))
            ],
            PrimaryArtists =
            [
                PrimaryArtist(collectionId, source.TrackId, "Candidate Artist"),
                .. candidates
                    .Where(candidate => candidate.CollectionId == collectionId)
                    .Select(candidate => PrimaryArtist(
                        collectionId,
                        candidate.TrackId,
                        "Candidate Artist"))
            ]
        };
    }

    private static LocalOriginalCandidateSnapshot.SourceTrackFact Source(
        CollectionId collectionId,
        TrackId? trackId = null,
        bool isOriginal = false,
        ExternalMetadataSource? recordingSource = null)
    {
        return new LocalOriginalCandidateSnapshot.SourceTrackFact
        {
            CollectionId = collectionId,
            TrackId = trackId ?? TrackId.New(),
            Title = "Pulse (Remix)",
            Duration = TimeSpan.FromMinutes(5),
            VersionYear = 2005,
            IsOriginal = isOriginal,
            RecordingSource = recordingSource
        };
    }

    private static LocalOriginalCandidateSnapshot.CandidateTrackFact Candidate(
        CollectionId collectionId,
        TrackId? trackId = null,
        string title = "Pulse",
        bool isOriginal = false,
        int? versionYear = 1999,
        ExternalMetadataSource? recordingSource = null)
    {
        return new LocalOriginalCandidateSnapshot.CandidateTrackFact
        {
            CollectionId = collectionId,
            TrackId = trackId ?? TrackId.New(),
            Title = title,
            Duration = TimeSpan.FromMinutes(5),
            VersionYear = versionYear,
            IsOriginal = isOriginal,
            RecordingSource = recordingSource
        };
    }

    private static LocalOriginalCandidateSnapshot.StackTrackFact StackTrack(
        LocalOriginalCandidateSnapshot.SourceTrackFact source)
    {
        return StackTrack(
            source.CollectionId,
            source.TrackId,
            source.Title,
            source.IsOriginal);
    }

    private static LocalOriginalCandidateSnapshot.StackTrackFact StackTrack(
        LocalOriginalCandidateSnapshot.CandidateTrackFact candidate)
    {
        return StackTrack(
            candidate.CollectionId,
            candidate.TrackId,
            candidate.Title,
            candidate.IsOriginal);
    }

    private static LocalOriginalCandidateSnapshot.StackTrackFact StackTrack(
        CollectionId collectionId,
        TrackId trackId,
        string title,
        bool isOriginal)
    {
        return new LocalOriginalCandidateSnapshot.StackTrackFact
        {
            CollectionId = collectionId,
            TrackId = trackId,
            Title = title,
            IsOriginal = isOriginal
        };
    }

    private static LocalOriginalCandidateSnapshot.StackRelationFact StackRelation(
        CollectionId collectionId,
        TrackId sourceTrackId,
        TrackId targetTrackId,
        string relationTypeCode)
    {
        return new LocalOriginalCandidateSnapshot.StackRelationFact
        {
            CollectionId = collectionId,
            SourceTrackId = sourceTrackId,
            TargetTrackId = targetTrackId,
            RelationTypeCode = relationTypeCode
        };
    }

    private static LocalOriginalCandidateSnapshot.AppearanceFact Appearance(
        CollectionId collectionId,
        TrackId trackId,
        int year)
    {
        return new LocalOriginalCandidateSnapshot.AppearanceFact
        {
            CollectionId = collectionId,
            TrackId = trackId,
            ReleaseDate = null,
            ReleaseYear = year
        };
    }

    private static LocalOriginalCandidateSnapshot.PrimaryArtistFact PrimaryArtist(
        CollectionId collectionId,
        TrackId trackId,
        string displayName)
    {
        return new LocalOriginalCandidateSnapshot.PrimaryArtistFact
        {
            CollectionId = collectionId,
            TrackId = trackId,
            DisplayName = displayName
        };
    }

    private static LocalOriginalCandidateSnapshot.CreditFact Credit(
        CollectionId collectionId,
        TrackId trackId,
        string roleCode,
        string contributorName)
    {
        return new LocalOriginalCandidateSnapshot.CreditFact
        {
            CollectionId = collectionId,
            TrackId = trackId,
            RoleCode = roleCode,
            ContributorName = contributorName
        };
    }

    private static LocalOriginalCandidateSnapshot.ParserRuleFact ParserRule(
        string relationTypeCode,
        string alias)
    {
        return new LocalOriginalCandidateSnapshot.ParserRuleFact
        {
            RuleId = TrackRelationParserRuleId.New(),
            RelationTypeCode = relationTypeCode,
            Alias = alias,
            MatchMode =
                TrackRelationParserRuleMatchMode.ExactLastParentheticalToken,
            Confidence = 100,
            Direction = TrackRelationParserRuleDirection.VariantToBase,
            SortOrder = 0,
            IsActive = true
        };
    }

    private static ExternalMetadataSource Recording(string externalId)
    {
        return new ExternalMetadataSource(
            "musicbrainz",
            "recording",
            externalId,
            $"https://musicbrainz.org/recording/{externalId}",
            "MusicBrainz");
    }

    private sealed class FakeLocalOriginalCandidateDataSource
        : ILocalOriginalCandidateDataSource
    {
        private readonly LocalOriginalCandidateSnapshot _snapshot;

        public FakeLocalOriginalCandidateDataSource(
            LocalOriginalCandidateSnapshot snapshot)
        {
            _snapshot = snapshot;
        }

        public Task<LocalOriginalCandidateSnapshot> LoadAsync(
            CollectionId collectionId,
            TrackId sourceTrackId,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(_snapshot);
        }
    }
}
