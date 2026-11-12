using System.Text.Json;
using DiscWeave.Api.Http;
using DiscWeave.Application.Errors;
using DiscWeave.Domain.Playlists;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Playlists;

public static partial class PlaylistsEndpointRouteBuilderExtensions
{
    private static async Task<IResult> SaveOrReplayCreateAsync(
        Playlist playlist, bool replayable, DiscWeaveDbContext context, CancellationToken cancellationToken)
    {
        if (replayable)
        {
            Playlist? existing = await FindPlaylistAsync(context, playlist.CollectionId, playlist.Id, cancellationToken);
            if (existing is not null)
            {
                return await ReplayCreateAsync(existing, playlist, context, cancellationToken);
            }
        }
        _ = context.Playlists.Add(playlist);
        try
        {
            _ = await context.SaveChangesAsync(cancellationToken);
        }
        catch (ResourceConflictException) when (replayable)
        {
            context.ChangeTracker.Clear();
            Playlist? winner = await FindPlaylistAsync(context, playlist.CollectionId, playlist.Id, cancellationToken);
            return winner is null
                ? CreateRequestConflict()
                : await ReplayCreateAsync(winner, playlist, context, cancellationToken);
        }
        return Results.Created($"/api/playlists/{playlist.Id}",
            await PlaylistMapper.ToResponseAsync(playlist, context, cancellationToken));
    }

    private static IResult CreateRequestConflict() => EndpointErrors.Conflict(
        "playlist.create_request_conflict", "This create request cannot be reused. Check the saved playlists before creating another.");

    private static async Task<IResult> ReplayCreateAsync(
        Playlist existing, Playlist requested, DiscWeaveDbContext context, CancellationToken cancellationToken)
    {
        return CreatePayload(existing) != CreatePayload(requested)
            ? CreateRequestConflict()
            : Results.Ok(await PlaylistMapper.ToResponseAsync(existing, context, cancellationToken));
    }

    // Compare normalized domain values, excluding generated entry identities and
    // derived display metadata. Repeated entries and their order remain significant.
    private static string CreatePayload(Playlist playlist) => JsonSerializer.Serialize(new
    {
        playlist.Name,
        playlist.Type,
        Description = playlist.Description.Match(value => value, () => string.Empty),
        Entries = playlist.Entries.Select(entry => new
        {
            entry.Position,
            entry.Kind,
            Track = entry.TrackId.Match(value => value.Value, () => Guid.Empty),
            Release = entry.ReleaseId.Match(value => value.Value, () => Guid.Empty),
        }),
        playlist.Rules.Tags,
        playlist.Rules.Genres,
        playlist.Rules.Media,
        playlist.Rules.OwnershipStatuses,
        YearFrom = playlist.Rules.YearFrom.Match(value => value, () => 0),
        YearTo = playlist.Rules.YearTo.Match(value => value, () => 0),
    });
}
