using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using DiscWeave.Infrastructure.Persistence.Queries;
using Microsoft.EntityFrameworkCore;
using CatalogCredit = DiscWeave.Domain.Credits.Credit;

namespace DiscWeave.Api.Tests;

public sealed partial class LocalOriginalCandidateServiceTests
{
    [Fact]
    public async Task Data_source_is_collection_scoped_and_leaves_no_tracked_entities()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync(
            CancellationToken.None);
        DbContextOptions<DiscWeaveDbContext> options =
            new DbContextOptionsBuilder<DiscWeaveDbContext>()
                .UseSqlite(connectionString)
                .Options;
        await using var context = new DiscWeaveDbContext(options);
        _ = await context.Database.EnsureCreatedAsync(CancellationToken.None);
        var ownerId = UserId.New();
        var foreignOwnerId = UserId.New();
        var collectionId = CollectionId.New();
        var foreignCollectionId = CollectionId.New();
        _ = context.MusicCollections.Add(
            MusicCollection.Create(collectionId, ownerId, "Local candidates"));
        _ = context.MusicCollections.Add(
            MusicCollection.Create(
                foreignCollectionId,
                foreignOwnerId,
                "Foreign candidates"));
        context.CollectionDictionaryEntries.AddRange(
            CollectionDictionaryDefaults.CreateEntries(collectionId));
        context.CollectionDictionaryEntries.AddRange(
            CollectionDictionaryDefaults.CreateEntries(foreignCollectionId));
        _ = context.TrackStackSettings.Add(
            TrackStackSettings.Create(
                collectionId,
                CollectionDictionaryDefaults.DefaultTrackStackRelationTypeCodes));
        context.TrackRelationParserRules.AddRange(
            CollectionDictionaryDefaults.CreateTrackRelationParserRules(
                collectionId));
        var source = Track.Create(
            collectionId,
            TrackId.New(),
            "Pulse (Remix)");
        var candidate = Track.Create(
            collectionId,
            TrackId.New(),
            "Pulse");
        var foreignSource = Track.Create(
            foreignCollectionId,
            TrackId.New(),
            "Pulse (Remix)");
        var foreignCandidate = Track.Create(
            foreignCollectionId,
            TrackId.New(),
            "Pulse");
        context.Tracks.AddRange(
            source,
            candidate,
            foreignSource,
            foreignCandidate);
        _ = await context.SaveChangesAsync(CancellationToken.None);
        context.ChangeTracker.Clear();
        var dataSource = new LocalOriginalCandidateDataSource(context);

        LocalOriginalCandidateSnapshot snapshot = await dataSource.LoadAsync(
            collectionId,
            source.Id,
            CancellationToken.None);
        LocalOriginalCandidateSnapshot foreignSnapshot =
            await dataSource.LoadAsync(
                collectionId,
                foreignSource.Id,
                CancellationToken.None);

        Assert.Equal(source.Id, snapshot.Source?.TrackId);
        Assert.Contains(
            snapshot.Candidates,
            item => item.TrackId == candidate.Id);
        Assert.DoesNotContain(
            snapshot.Candidates,
            item => item.TrackId == foreignCandidate.Id);
        Assert.Null(foreignSnapshot.Source);
        Assert.Empty(foreignSnapshot.Candidates);
        Assert.Empty(context.ChangeTracker.Entries());
    }

    [Fact]
    public async Task Data_source_projects_catalog_evidence_without_tracking()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync(
            CancellationToken.None);
        DbContextOptions<DiscWeaveDbContext> options =
            new DbContextOptionsBuilder<DiscWeaveDbContext>()
                .UseSqlite(connectionString)
                .Options;
        await using var context = new DiscWeaveDbContext(options);
        _ = await context.Database.EnsureCreatedAsync(CancellationToken.None);
        var collectionId = CollectionId.New();
        var artist = Person.Create(
            collectionId,
            ArtistId.New(),
            "Candidate Artist");
        Track source = Track.Create(
            collectionId,
            TrackId.New(),
            "Pulse (Remix)")
            .WithDuration(TimeSpan.FromMinutes(5));
        source.UpdateMetadata(
            source.Metadata.WithVersionYear(2005));
        source.ReplaceExternalSources(
        [
            ExternalSourceReference.Create(
                "musicbrainz",
                "recording",
                "95f4d6df-9ea4-4b25-bc02-59f84cc1c407",
                "https://musicbrainz.org/recording/95f4d6df-9ea4-4b25-bc02-59f84cc1c407",
                DateTimeOffset.UtcNow)
        ]);
        Track candidate = Track.Create(
            collectionId,
            TrackId.New(),
            "Pulse")
            .WithDuration(TimeSpan.FromMinutes(4));
        candidate.UpdateMetadata(
            candidate.Metadata
                .WithVersionYear(1999)
                .WithOriginalMarker(true));
        var nonPrimaryTrack = Track.Create(
            collectionId,
            TrackId.New(),
            "Pulse (Dub)");
        var release = Release.Create(
            collectionId,
            ReleaseId.New(),
            "Pulse");
        release.UpdateSummary(
            release.Summary.WithMetadata(
                release.Summary.Metadata
                    .WithReleaseYear(1999)
                    .WithReleaseDate(new DateOnly(1999, 2, 3))));
        release.ReplaceTracklist(
        [
            ReleaseTrack.Create(
                candidate.Id,
                TrackPosition.FromNumber(1))
        ]);
        var sourceCredit = CatalogCredit.Create(
            collectionId,
            CreditId.New(),
            CreditContributor.FromArtist(artist),
            CreditTarget.ForTrack(source.Id),
            ["mainArtist", "remixer"]);
        var candidateCredit = CatalogCredit.Create(
            collectionId,
            CreditId.New(),
            CreditContributor.FromArtist(artist),
            CreditTarget.ForTrack(candidate.Id),
            "mainArtist");
        var producerCredit = CatalogCredit.Create(
            collectionId,
            CreditId.New(),
            CreditContributor.FromArtist(artist),
            CreditTarget.ForTrack(nonPrimaryTrack.Id),
            "producer");
        var relation = TrackRelation.Create(
            TrackRelationId.New(),
            collectionId,
            source.Id,
            candidate.Id,
            "remixOf");

        _ = context.MusicCollections.Add(
            MusicCollection.Create(
                collectionId,
                UserId.New(),
                "Evidence"));
        context.CollectionDictionaryEntries.AddRange(
            CollectionDictionaryDefaults.CreateEntries(collectionId));
        _ = context.TrackStackSettings.Add(
            TrackStackSettings.Create(collectionId, ["remixOf"]));
        context.TrackRelationParserRules.AddRange(
            CollectionDictionaryDefaults.CreateTrackRelationParserRules(
                collectionId));
        _ = context.Artists.Add(artist);
        context.Tracks.AddRange(source, candidate, nonPrimaryTrack);
        _ = context.Releases.Add(release);
        context.Credits.AddRange(
            sourceCredit,
            candidateCredit,
            producerCredit);
        _ = context.TrackRelations.Add(relation);
        _ = await context.SaveChangesAsync(CancellationToken.None);
        context.ChangeTracker.Clear();
        var dataSource = new LocalOriginalCandidateDataSource(context);

        LocalOriginalCandidateSnapshot snapshot = await dataSource.LoadAsync(
            collectionId,
            source.Id,
            CancellationToken.None);

        Assert.Equal(TimeSpan.FromMinutes(5), snapshot.Source?.Duration);
        Assert.Equal(2005, snapshot.Source?.VersionYear);
        Assert.Equal(
            "95f4d6df-9ea4-4b25-bc02-59f84cc1c407",
            snapshot.Source?.RecordingSource?.ExternalId);
        Assert.Contains(
            snapshot.StackRelations,
            item => item.SourceTrackId == source.Id
                && item.TargetTrackId == candidate.Id
                && item.RelationTypeCode == "remixOf");
        Assert.Contains(
            snapshot.Appearances,
            item => item.TrackId == candidate.Id
                && item.ReleaseDate == new DateOnly(1999, 2, 3)
                && item.ReleaseYear == 1999);
        Assert.Contains(
            snapshot.PrimaryArtists,
            item => item.TrackId == candidate.Id
                && item.DisplayName == artist.Name);
        Assert.DoesNotContain(
            snapshot.PrimaryArtists,
            item => item.TrackId == nonPrimaryTrack.Id);
        Assert.Contains(
            snapshot.Credits,
            item => item.TrackId == source.Id
                && item.RoleCode == "remixer"
                && item.ContributorName == artist.Name);
        Assert.Equal(["remixOf"], snapshot.EnabledStackRelationTypeCodes);
        Assert.Contains(
            snapshot.ParserRules,
            item => item.RelationTypeCode == "remixOf"
                && item.Direction
                    == TrackRelationParserRuleDirection.VariantToBase);
        Assert.Empty(context.ChangeTracker.Entries());
    }
}
