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
        HashSet<TrackId> visitedMembers = [];
        Queue<TraversalNode> queue = [];
        queue.Enqueue(new TraversalNode(original.Id, 0));

        while (queue.TryDequeue(out TraversalNode node))
        {
            foreach (TrackRelation relation in _incoming[node.TrackId])
            {
                TrackId sourceTrackId = relation.SourceTrackId;
                if (!_tracksById.TryGetValue(sourceTrackId, out Track? sourceTrack) ||
                    sourceTrackId == original.Id ||
                    !visitedMembers.Add(sourceTrackId))
                {
                    continue;
                }

                members.Add(new TrackStackMemberProjection(
                    sourceTrack,
                    TrackRelationTypeCodeValue.From(relation.RelationType),
                    node.Depth + 1,
                    node.TrackId == original.Id));
                queue.Enqueue(new TraversalNode(sourceTrackId, node.Depth + 1));
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
            FindCyclePaths(original.Id));
    }

    private List<IReadOnlyList<TrackId>> FindCyclePaths(
        TrackId originalId)
    {
        List<IReadOnlyList<TrackId>> cyclePaths = [];
        Dictionary<TrackId, VisitState> states = [];
        List<TrackId> activePath = [];
        Dictionary<TrackId, int> activeIndexes = [];
        HashSet<string> cycleKeys = [];
        Stack<CycleTraversalFrame> traversal = [];

        Enter(originalId);
        while (traversal.TryPop(out CycleTraversalFrame frame))
        {
            if (frame.IsComplete)
            {
                activePath.RemoveAt(activePath.Count - 1);
                _ = activeIndexes.Remove(frame.TrackId);
                states[frame.TrackId] = VisitState.Complete;
                continue;
            }

            TrackId sourceTrackId = frame.NextSourceTrackId;
            traversal.Push(frame.Advance());
            if (!_tracksById.ContainsKey(sourceTrackId))
            {
                continue;
            }

            if (!states.TryGetValue(sourceTrackId, out VisitState state))
            {
                Enter(sourceTrackId);
                continue;
            }

            if (state != VisitState.Active)
            {
                continue;
            }

            int cycleStart = activeIndexes[sourceTrackId];
            IReadOnlyList<TrackId> path =
            [
                .. activePath.Skip(cycleStart),
                sourceTrackId
            ];
            string key = string.Join(
                ">",
                path.Select(id => id.Value));
            if (cycleKeys.Add(key))
            {
                cyclePaths.Add(path);
            }
        }

        return cyclePaths;

        void Enter(TrackId trackId)
        {
            states[trackId] = VisitState.Active;
            activeIndexes[trackId] = activePath.Count;
            activePath.Add(trackId);
            traversal.Push(new CycleTraversalFrame(
                trackId,
                [.. _incoming[trackId].Select(relation => relation.SourceTrackId)],
                0));
        }
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
            int depth)
        {
            TrackId = trackId;
            Depth = depth;
        }

        public TrackId TrackId { get; }
        public int Depth { get; }
    }

    private readonly struct CycleTraversalFrame
    {
        public CycleTraversalFrame(
            TrackId trackId,
            IReadOnlyList<TrackId> sourceTrackIds,
            int nextIndex)
        {
            TrackId = trackId;
            SourceTrackIds = sourceTrackIds;
            NextIndex = nextIndex;
        }

        public TrackId TrackId { get; }
        public IReadOnlyList<TrackId> SourceTrackIds { get; }
        public int NextIndex { get; }
        public bool IsComplete => NextIndex >= SourceTrackIds.Count;
        public TrackId NextSourceTrackId => SourceTrackIds[NextIndex];

        public CycleTraversalFrame Advance()
        {
            return new CycleTraversalFrame(
                TrackId,
                SourceTrackIds,
                NextIndex + 1);
        }
    }

    private enum VisitState
    {
        Active,
        Complete
    }
}
