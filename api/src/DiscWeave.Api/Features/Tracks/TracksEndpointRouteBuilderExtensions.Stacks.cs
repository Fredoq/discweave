using DiscWeave.Api.Features.Settings;
using DiscWeave.Api.Http;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Ids;
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
        Dictionary<TrackId, Track> tracksById = tracks.ToDictionary(track => track.Id);
        ILookup<TrackId, TrackRelation> incomingRelations = relations.ToLookup(relation => relation.TargetTrackId);
        TrackStackResponse[] responses =
        [
            .. originals.Select(original => BuildTrackStack(original, incomingRelations, tracksById))
                .OrderBy(stack => stack.OriginalTitle, StringComparer.OrdinalIgnoreCase)
                .ThenBy(stack => stack.OriginalTrackId)
        ];

        return Results.Ok(new ListResponse<TrackStackResponse>(responses, responses.Length, 0, responses.Length));
    }

    private static TrackStackResponse BuildTrackStack(
        Track original,
        ILookup<TrackId, TrackRelation> incomingRelations,
        Dictionary<TrackId, Track> tracksById)
    {
        List<TrackStackMemberResponse> members = [];
        List<TrackStackIssueResponse> issues = [];
        HashSet<TrackId> visitedMembers = [];
        HashSet<string> issueKeys = [];
        Queue<TrackStackTraversalNode> queue = [];
        queue.Enqueue(new TrackStackTraversalNode(original.Id, 0, [original.Id]));

        while (queue.TryDequeue(out TrackStackTraversalNode node))
        {
            foreach (TrackRelation relation in incomingRelations[node.TrackId])
            {
                TrackId sourceTrackId = relation.SourceTrackId;
                if (sourceTrackId == original.Id || node.Path.Contains(sourceTrackId))
                {
                    AddCycleIssue(issues, issueKeys, [.. node.Path, sourceTrackId]);
                    continue;
                }

                if (!tracksById.TryGetValue(sourceTrackId, out Track? sourceTrack))
                {
                    continue;
                }

                if (visitedMembers.Add(sourceTrackId))
                {
                    members.Add(new TrackStackMemberResponse(
                        sourceTrack.Id.Value,
                        sourceTrack.Title,
                        VersionYear(sourceTrack),
                        relation.RelationType,
                        node.Depth + 1,
                        node.TrackId == original.Id));
                    queue.Enqueue(new TrackStackTraversalNode(sourceTrackId, node.Depth + 1, [.. node.Path, sourceTrackId]));
                }
            }
        }

        TrackStackMemberResponse[] sortedMembers =
        [
            .. members
                .OrderBy(member => member.Depth)
                .ThenBy(member => member.Title, StringComparer.OrdinalIgnoreCase)
                .ThenBy(member => member.TrackId)
        ];

        return new TrackStackResponse(
            original.Id.Value,
            original.Title,
            VersionYear(original),
            sortedMembers.Length,
            issues.Count > 0,
            sortedMembers,
            issues);
    }

    private static void AddCycleIssue(
        List<TrackStackIssueResponse> issues,
        HashSet<string> issueKeys,
        IReadOnlyList<TrackId> path)
    {
        string key = string.Join(">", path.Select(trackId => trackId.Value));
        if (!issueKeys.Add(key))
        {
            return;
        }

        issues.Add(new TrackStackIssueResponse("track_stack.cycle", [.. path.Select(trackId => trackId.Value)]));
    }

    private static int? VersionYear(Track track)
    {
        return track.Metadata.VersionYear is PresentOptionalValue<int> presentYear
            ? presentYear.Value
            : null;
    }

    private readonly record struct TrackStackTraversalNode(TrackId TrackId, int Depth, IReadOnlyList<TrackId> Path);
}
