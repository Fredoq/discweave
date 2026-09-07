using DiscWeave.Api.Http;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.Catalog.TrackStacks;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using DiscWeave.Infrastructure.Persistence.Queries;
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
            out bool suggestions,
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
        TrackRelationParserRule[] parserRules = suggestions
            ? await context.TrackRelationParserRules.AsNoTracking()
                .Where(rule => rule.CollectionId == currentCollection.CollectionId && rule.IsActive)
                .OrderBy(rule => rule.SortOrder)
                .ThenBy(rule => rule.Id)
                .ToArrayAsync(cancellationToken)
            : [];
        IReadOnlyDictionary<TrackId, string> artistDisplays =
            await LoadTrackArtistDisplaysAsync(
                [.. stacks.SelectMany(StackTrackIds).Append(source.Id).Distinct()],
                context,
                currentCollection.CollectionId,
                cancellationToken);
        string sourceTitleKey = SuggestionTitleKey(source.Title, parserRules);
        string? sourceArtistKey = artistDisplays.TryGetValue(source.Id, out string? sourceArtist)
            ? OriginalDiscoveryTextNormalizer.ForArtistKey(sourceArtist)
            : null;
        StackTargetMatch[] matches =
        [
            .. stacks
                .Select(stack =>
                    suggestions
                        ? SuggestStackTarget(
                            stack,
                            artistDisplays,
                            sourceTitleKey,
                            sourceArtistKey,
                            parserRules)
                        : MatchStackTarget(stack, artistDisplays, search))
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
        out bool suggestions,
        out int offset,
        out int limit,
        out IResult error)
    {
        sourceTrackId = request.SourceTrackId ?? Guid.Empty;
        search = request.Search?.Trim() ?? string.Empty;
        suggestions = request.Search is null;
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

        if (!suggestions && search.Length is < 2 or > 200)
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

}
