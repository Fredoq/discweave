using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Application.Catalog.TrackStacks;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
    private static async Task MarkOriginalAsync(HttpClient client, Guid trackId, string title, int versionYear)
    {
        using HttpResponseMessage response = await client.PutAsJsonAsync(
            $"/api/tracks/{trackId}",
            new
            {
                title,
                versionYear,
                isOriginal = true,
                genres = Array.Empty<string>(),
                tags = Array.Empty<string>(),
                credits = Array.Empty<object>(),
                releaseAppearances = Array.Empty<object>()
            });
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(document.RootElement.GetProperty("isOriginal").GetBoolean());
    }

    private static async Task<Guid> CreateTrackRelationAsync(
        HttpClient client,
        Guid sourceTrackId,
        Guid targetTrackId,
        string type)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/track-relations",
            new { sourceTrackId, targetTrackId, type });
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        return document.RootElement.GetProperty("id").GetGuid();
    }

    private async Task<(DiscWeaveDbContext Context, CollectionId CollectionId)>
        CreateStackAssignmentContextAsync(
            IReadOnlyList<string>? configuredRelationTypeCodes = null)
    {
        string connectionString = await _sqlite.CreateDatabaseAsync(
            CancellationToken.None);
        DbContextOptions<DiscWeaveDbContext> options =
            new DbContextOptionsBuilder<DiscWeaveDbContext>()
                .UseSqlite(connectionString)
                .Options;
        var context = new DiscWeaveDbContext(options);
        _ = await context.Database.EnsureCreatedAsync(
            CancellationToken.None);

        var collectionId = CollectionId.New();
        _ = context.MusicCollections.Add(
            MusicCollection.Create(
                collectionId,
                UserId.New(),
                "Stack assignment tests"));
        context.CollectionDictionaryEntries.AddRange(
            CollectionDictionaryDefaults.CreateEntries(collectionId));
        _ = context.TrackStackSettings.Add(
            TrackStackSettings.Create(
                collectionId,
                configuredRelationTypeCodes ??
                    CollectionDictionaryDefaults
                        .DefaultTrackStackRelationTypeCodes));
        _ = await context.SaveChangesAsync(
            CancellationToken.None);

        return (context, collectionId);
    }

    private static TrackStackAssignmentService
        CreateStackAssignmentService()
    {
        return new TrackStackAssignmentService(
            new TrackStackRelationValidator());
    }

    private static Track AddStackAssignmentTrack(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        string title,
        bool isOriginal = false)
    {
        var track = Track.Create(
            collectionId,
            TrackId.New(),
            title);
        if (isOriginal)
        {
            track.UpdateMetadata(
                track.Metadata.WithOriginalMarker(true));
        }

        _ = context.Tracks.Add(track);

        return track;
    }
}
