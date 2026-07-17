using DiscWeave.Api.Features.Settings;
using DiscWeave.Api.Http;
using DiscWeave.Application.Catalog.TrackStacks;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Tracks;

public static partial class TracksEndpointRouteBuilderExtensions
{
    private static async Task<IResult> ListTrackStacksAsync(
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<string> relationTypeCodes = await TrackStackSettingsReader.GetDefaultRelationTypeCodesAsync(
            context,
            currentCollection.CollectionId,
            cancellationToken);
        if (relationTypeCodes.Count == 0)
        {
            return Results.Ok(new ListResponse<TrackStackResponse>([], 0, 0, 0));
        }

        Track[] tracks = await context.Tracks.AsNoTracking()
            .Where(track => track.CollectionId == currentCollection.CollectionId)
            .OrderBy(track => track.Title)
            .ThenBy(track => track.Id)
            .ToArrayAsync(cancellationToken);
        Track[] originals = [.. tracks.Where(track => track.Metadata.IsOriginal)];
        if (originals.Length == 0)
        {
            return Results.Ok(new ListResponse<TrackStackResponse>([], 0, 0, 0));
        }

        TrackRelation[] relations = await context.TrackRelations.AsNoTracking()
            .Where(relation => relation.CollectionId == currentCollection.CollectionId &&
                relationTypeCodes.Contains(relation.RelationType))
            .OrderBy(relation => relation.RelationType)
            .ThenBy(relation => relation.SourceTrackId)
            .ToArrayAsync(cancellationToken);
        var graph = new TrackStackGraph(tracks, relations);
        TrackStackResponse[] responses =
        [
            .. originals
                .Select(graph.Project)
                .Select(ToTrackStackResponse)
                .OrderBy(stack => stack.OriginalTitle, StringComparer.OrdinalIgnoreCase)
                .ThenBy(stack => stack.OriginalTrackId)
        ];

        return Results.Ok(new ListResponse<TrackStackResponse>(responses, responses.Length, 0, responses.Length));
    }

    private static TrackStackResponse ToTrackStackResponse(
        TrackStackProjection projection)
    {
        TrackStackMemberResponse[] members =
        [
            .. projection.Members.Select(member => new TrackStackMemberResponse(
                member.Track.Id.Value,
                member.Track.Title,
                VersionYear(member.Track),
                member.RelationType.Value,
                member.Depth,
                member.IsDirect))
        ];
        TrackStackIssueResponse[] issues =
        [
            .. projection.CyclePaths.Select(path => new TrackStackIssueResponse(
                "track_stack.cycle",
                [.. path.Select(trackId => trackId.Value)]))
        ];

        return new TrackStackResponse(
            projection.Original.Id.Value,
            projection.Original.Title,
            VersionYear(projection.Original),
            members.Length,
            issues.Length > 0,
            members,
            issues);
    }

    private static int? VersionYear(Track track)
    {
        return track.Metadata.VersionYear is PresentOptionalValue<int> presentYear
            ? presentYear.Value
            : null;
    }
}
