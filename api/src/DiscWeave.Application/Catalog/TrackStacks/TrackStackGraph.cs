using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Application.Catalog.TrackStacks;

public sealed class TrackStackGraph
{
    private readonly Dictionary<TrackId, Track> _tracksById;
    private readonly ILookup<TrackId, TrackRelation> _incoming;
    private readonly ILookup<TrackId, TrackRelation> _outgoing;

    public TrackStackGraph(
        IReadOnlyCollection<Track> tracks,
        IReadOnlyCollection<TrackRelation> stackRelations)
    {
        _tracksById = tracks.ToDictionary(track => track.Id);
        TrackRelation[] orderedRelations =
        [
            .. stackRelations
                .OrderBy(relation => relation.RelationType, StringComparer.Ordinal)
                .ThenBy(relation => relation.SourceTrackId.Value)
                .ThenBy(relation => relation.TargetTrackId.Value)
        ];
        _incoming = orderedRelations.ToLookup(relation => relation.TargetTrackId);
        _outgoing = orderedRelations.ToLookup(relation => relation.SourceTrackId);
    }

    public bool IsStandalone(TrackId trackId)
    {
        return _tracksById.ContainsKey(trackId) &&
            !_incoming[trackId].Any() &&
            !_outgoing[trackId].Any();
    }

    public bool HasMembers(TrackId trackId)
    {
        return _incoming[trackId].Any();
    }

    public bool IsMember(TrackId trackId)
    {
        return _outgoing[trackId].Any();
    }

    public bool WouldCreateCycle(TrackId sourceTrackId, TrackId targetTrackId)
    {
        return HasPath(targetTrackId, sourceTrackId);
    }

    public TrackStackProjection Project(Track original)
    {
        List<TrackStackMemberProjection> members = [];
        List<IReadOnlyList<TrackId>> cyclePaths = [];
        HashSet<TrackId> visitedMembers = [];
        HashSet<string> cycleKeys = [];
        Queue<TraversalNode> queue = [];
        queue.Enqueue(new TraversalNode(original.Id, 0, [original.Id]));

        while (queue.TryDequeue(out TraversalNode node))
        {
            foreach (TrackRelation relation in _incoming[node.TrackId])
            {
                TrackId sourceTrackId = relation.SourceTrackId;
                if (sourceTrackId == original.Id || node.Path.Contains(sourceTrackId))
                {
                    IReadOnlyList<TrackId> path = [.. node.Path, sourceTrackId];
                    string key = string.Join(">", path.Select(id => id.Value));
                    if (cycleKeys.Add(key))
                    {
                        cyclePaths.Add(path);
                    }

                    continue;
                }

                if (!_tracksById.TryGetValue(sourceTrackId, out Track? sourceTrack) ||
                    !visitedMembers.Add(sourceTrackId))
                {
                    continue;
                }

                members.Add(new TrackStackMemberProjection(
                    sourceTrack,
                    relation.RelationType,
                    node.Depth + 1,
                    node.TrackId == original.Id));
                queue.Enqueue(new TraversalNode(
                    sourceTrackId,
                    node.Depth + 1,
                    [.. node.Path, sourceTrackId]));
            }
        }

        return new TrackStackProjection(
            original,
            [
                .. members
                    .OrderBy(member => member.Depth)
                    .ThenBy(member => member.Track.Title, StringComparer.OrdinalIgnoreCase)
                    .ThenBy(member => member.Track.Id.Value)
            ],
            cyclePaths);
    }

    private bool HasPath(TrackId startTrackId, TrackId targetTrackId)
    {
        HashSet<TrackId> visited = [];
        Queue<TrackId> queue = [];
        queue.Enqueue(startTrackId);

        while (queue.TryDequeue(out TrackId trackId))
        {
            if (trackId == targetTrackId)
            {
                return true;
            }

            if (!visited.Add(trackId))
            {
                continue;
            }

            foreach (TrackRelation relation in _outgoing[trackId])
            {
                queue.Enqueue(relation.TargetTrackId);
            }
        }

        return false;
    }

    private readonly struct TraversalNode
    {
        public TraversalNode(
            TrackId trackId,
            int depth,
            IReadOnlyList<TrackId> path)
        {
            TrackId = trackId;
            Depth = depth;
            Path = path;
        }

        public TrackId TrackId { get; }
        public int Depth { get; }
        public IReadOnlyList<TrackId> Path { get; }
    }
}
