using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Credits;
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
    public async Task Data_source_skips_expensive_evidence_queries_for_original_sources()
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
        _ = context.MusicCollections.Add(
            MusicCollection.Create(collectionId, UserId.New(), "Original source"));
        context.CollectionDictionaryEntries.AddRange(
            CollectionDictionaryDefaults.CreateEntries(collectionId));
        _ = context.TrackStackSettings.Add(
            TrackStackSettings.Create(
                collectionId,
                CollectionDictionaryDefaults.DefaultTrackStackRelationTypeCodes));
        context.TrackRelationParserRules.AddRange(
            CollectionDictionaryDefaults.CreateTrackRelationParserRules(
                collectionId));
        var source = Track.Create(collectionId, TrackId.New(), "Pulse");
        source.UpdateMetadata(source.Metadata.WithOriginalMarker(true));
        var artist = Person.Create(collectionId, ArtistId.New(), "Pulse Artist");
        var release = Release.Create(collectionId, ReleaseId.New(), "Pulse");
        release.ReplaceTracklist(
        [
            ReleaseTrack.Create(source.Id, TrackPosition.FromNumber(1))
        ]);
        _ = context.Tracks.Add(source);
        _ = context.Artists.Add(artist);
        _ = context.Releases.Add(release);
        _ = context.Credits.Add(
            CatalogCredit.Create(
                collectionId,
                CreditId.New(),
                CreditContributor.FromArtist(artist),
                CreditTarget.ForTrack(source.Id),
                "mainArtist"));
        _ = await context.SaveChangesAsync(CancellationToken.None);
        context.ChangeTracker.Clear();

        LocalOriginalCandidateSnapshot snapshot =
            await new LocalOriginalCandidateDataSource(context).LoadAsync(
                collectionId,
                source.Id,
                CancellationToken.None);

        Assert.True(snapshot.Source?.IsOriginal);
        Assert.Empty(snapshot.Appearances);
        Assert.Empty(snapshot.PrimaryArtists);
        Assert.Empty(snapshot.Credits);
    }
}
