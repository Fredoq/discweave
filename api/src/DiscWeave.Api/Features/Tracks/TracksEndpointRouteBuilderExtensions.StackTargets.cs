using DiscWeave.Api.Features.Settings;
using DiscWeave.Api.Http;
using DiscWeave.Application.Catalog.TrackStacks;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Tracks;

public static partial class TracksEndpointRouteBuilderExtensions
{
    private static async Task<IResult> ListTrackStackTargetsAsync(
        [AsParameters] TrackStackTargetListRequest request,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        if (!TryNormalizeStackTargetRequest(
            request,
            out Guid sourceTrackId,
            out string search,
            out int offset,
            out int limit,
            out IResult error))
        {
            return error;
        }

        Track? source = await context.Tracks.AsNoTracking()
            .SingleOrDefaultAsync(
                track =>
                    track.CollectionId == currentCollection.CollectionId &&
                    track.Id == new TrackId(sourceTrackId),
                cancellationToken);
        if (source is null)
        {
            return EndpointErrors.NotFound(
                "track.not_found",
                "Track was not found");
        }

        IReadOnlyList<string> typeCodes =
            await TrackStackSettingsReader.GetDefaultRelationTypeCodesAsync(
                context,
                currentCollection.CollectionId,
                cancellationToken);
        Track[] tracks = await LoadStackTracksAsync(
            context,
            currentCollection.CollectionId,
            cancellationToken);
        TrackRelation[] relations = await LoadStackRelationsAsync(
            context,
            currentCollection.CollectionId,
            typeCodes,
            cancellationToken);
        var graph = new TrackStackGraph(tracks, relations);
        if (!graph.IsStandalone(source.Id))
        {
            return EndpointErrors.Conflict(
                "track_stack.source_not_standalone",
                "Track is not eligible for stack assignment");
        }

        TrackStackProjection[] stacks =
        [
            .. tracks
                .Where(track =>
                    track.Metadata.IsOriginal &&
                    track.Id != source.Id)
                .Select(graph.Project)
                .Where(stack => stack.Members.Count > 0)
        ];
        IReadOnlyDictionary<TrackId, string> artistDisplays =
            await LoadTrackArtistDisplaysAsync(
                [.. stacks.SelectMany(StackTrackIds).Distinct()],
                context,
                currentCollection.CollectionId,
                cancellationToken);
        StackTargetMatch[] matches =
        [
            .. stacks
                .Select(stack =>
                    MatchStackTarget(stack, artistDisplays, search))
                .OfType<StackTargetMatch>()
                .OrderBy(match => match.Rank)
                .ThenBy(
                    match => match.Response.Title,
                    StringComparer.OrdinalIgnoreCase)
                .ThenBy(match => match.Response.RootTrackId)
        ];

        return Results.Ok(new ListResponse<TrackStackTargetResponse>(
            [
                .. matches
                    .Skip(offset)
                    .Take(limit)
                    .Select(match => match.Response)
            ],
            limit,
            offset,
            matches.Length));
    }

    private static bool TryNormalizeStackTargetRequest(
        TrackStackTargetListRequest request,
        out Guid sourceTrackId,
        out string search,
        out int offset,
        out int limit,
        out IResult error)
    {
        sourceTrackId = request.SourceTrackId ?? Guid.Empty;
        search = request.Search?.Trim() ?? string.Empty;
        offset = request.Offset ?? 0;
        int requestedLimit = request.Limit ?? 20;
        limit = Math.Min(requestedLimit, 50);
        error = Results.Empty;

        if (sourceTrackId == Guid.Empty)
        {
            error = EndpointErrors.BadRequest(
                "track_stack.source_required",
                "Source track is required");
            return false;
        }

        if (search.Length is < 2 or > 200)
        {
            error = EndpointErrors.BadRequest(
                "track_stack.search_invalid",
                "Stack target search must contain between 2 and 200 characters");
            return false;
        }

        if (offset < 0 || requestedLimit <= 0)
        {
            error = EndpointErrors.BadRequest(
                "pagination.invalid",
                "Pagination values are invalid");
            return false;
        }

        return true;
    }

    private static async Task<Track[]> LoadStackTracksAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        return await context.Tracks.AsNoTracking()
            .Where(track => track.CollectionId == collectionId)
            .OrderBy(track => track.Title)
            .ThenBy(track => track.Id)
            .ToArrayAsync(cancellationToken);
    }

    private static async Task<TrackRelation[]> LoadStackRelationsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyList<string> relationTypeCodes,
        CancellationToken cancellationToken)
    {
        return relationTypeCodes.Count == 0
            ? []
            : await context.TrackRelations.AsNoTracking()
                .Where(relation =>
                    relation.CollectionId == collectionId &&
                    relationTypeCodes.Contains(relation.RelationType))
                .OrderBy(relation => relation.RelationType)
                .ThenBy(relation => relation.SourceTrackId)
                .ThenBy(relation => relation.TargetTrackId)
                .ToArrayAsync(cancellationToken);
    }

    private static IEnumerable<TrackId> StackTrackIds(
        TrackStackProjection stack)
    {
        yield return stack.Original.Id;
        foreach (TrackStackMemberProjection member in stack.Members)
        {
            yield return member.Track.Id;
        }
    }

    private static StackTargetMatch? MatchStackTarget(
        TrackStackProjection stack,
        IReadOnlyDictionary<TrackId, string> artistDisplays,
        string search)
    {
        string rootArtist = artistDisplays.GetValueOrDefault(
            stack.Original.Id,
            "Unknown artist");
        int? rootRank = null;
        if (stack.Original.Title.Contains(
            search,
            StringComparison.OrdinalIgnoreCase))
        {
            rootRank = 0;
        }
        else if (rootArtist.Contains(
            search,
            StringComparison.OrdinalIgnoreCase))
        {
            rootRank = 1;
        }
        TrackStackMemberProjection? matchedMember = rootRank.HasValue
            ? null
            : stack.Members
                .Where(member =>
                    member.Track.Title.Contains(
                        search,
                        StringComparison.OrdinalIgnoreCase) ||
                    artistDisplays.GetValueOrDefault(
                        member.Track.Id,
                        "Unknown artist").Contains(
                            search,
                            StringComparison.OrdinalIgnoreCase))
                .OrderBy(
                    member => member.Track.Title,
                    StringComparer.OrdinalIgnoreCase)
                .ThenBy(member => member.Track.Id.Value)
                .FirstOrDefault();
        if (!rootRank.HasValue && matchedMember is null)
        {
            return null;
        }

        TrackStackTargetMatchedMemberResponse? memberResponse =
            matchedMember is null
                ? null
                : new TrackStackTargetMatchedMemberResponse(
                    matchedMember.Track.Id.Value,
                    matchedMember.Track.Title,
                    artistDisplays.GetValueOrDefault(
                        matchedMember.Track.Id,
                        "Unknown artist"));
        var response = new TrackStackTargetResponse(
            stack.Original.Id.Value,
            stack.Original.Title,
            rootArtist,
            VersionYear(stack.Original),
            stack.Members.Count,
            memberResponse);
        return new StackTargetMatch
        {
            Rank = rootRank ?? 2,
            Response = response
        };
    }

    private sealed class StackTargetMatch
    {
        public required int Rank { get; init; }
        public required TrackStackTargetResponse Response { get; init; }
    }
}
