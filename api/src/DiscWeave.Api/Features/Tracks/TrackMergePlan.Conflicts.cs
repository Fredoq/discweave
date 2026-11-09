using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Ratings;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Features.Tracks;

internal sealed partial class TrackMergePlan
{
    private List<TrackMergeConflictResponse> FindConflicts()
    {
        List<TrackMergeConflictResponse> conflicts = [.. Imports.GetConflicts(_keeper.Id)];
        if (SelectedRatings().GroupBy(rating => rating.CriterionId)
            .Any(ratings => ratings.Select(rating => (rating.Rating.Value, rating.IsStandout)).Distinct().Skip(1).Any()))
        {
            conflicts.Add(new TrackMergeConflictResponse("track_merge.rating_conflict",
                "Selected records have different values for the same rating criterion; align those ratings before merging"));
        }

        if (_relations.Any(relation => Remap(relation.SourceTrackId) == Remap(relation.TargetTrackId)))
        {
            conflicts.Add(new TrackMergeConflictResponse("track_merge.self_relation",
                "Selected records have a relation to each other; resolve that relation before merging"));
            return conflicts;
        }

        TrackRelation[] stackRelations = [.. _relations.Where(relation => _stackTypes.Contains(relation.RelationType))];
        ILookup<TrackId, TrackId> outgoing = stackRelations.ToLookup(relation => Remap(relation.SourceTrackId), relation => Remap(relation.TargetTrackId));
        if (ReachesKeeper(outgoing))
        {
            conflicts.Add(new TrackMergeConflictResponse("track_merge.stack_cycle",
                "Merging these records would create a track stack cycle; resolve the stack relations first"));
        }

        bool dropsRoot = !_keeper.Metadata.IsOriginal && _tracks.Any(track => _duplicates.Contains(track.Id) && track.Metadata.IsOriginal &&
            stackRelations.Any(relation => relation.TargetTrackId == track.Id));
        if (dropsRoot || (_keeper.Metadata.IsOriginal && outgoing[_keeper.Id].Any()))
        {
            conflicts.Add(new TrackMergeConflictResponse("track_merge.original_conflict",
                "The selected keeper would change the meaning of an original track stack; choose the original record or resolve its stack membership first"));
        }

        HashSet<TrackId> roots = [];
        foreach (Track track in _tracks.Where(track => IsSelected(track.Id)))
        {
            roots.UnionWith(FindRoots(track.Id, stackRelations));
        }
        if (roots.Select(Remap).Distinct().Skip(1).Any())
        {
            conflicts.Add(new TrackMergeConflictResponse("track_merge.different_stacks",
                "Selected records belong to different original track stacks; resolve their stack membership before merging"));
        }

        return conflicts;
    }

    private IEnumerable<RatingValue> SelectedRatings()
    {
        return _ratings.Where(rating => rating.Target is TrackRatingTarget target && IsSelected(target.TrackId));
    }

    private bool ReachesKeeper(ILookup<TrackId, TrackId> outgoing)
    {
        HashSet<TrackId> visited = [];
        Queue<TrackId> queue = new(outgoing[_keeper.Id]);
        while (queue.TryDequeue(out TrackId current))
        {
            if (current == _keeper.Id)
            {
                return true;
            }
            if (visited.Add(current))
            {
                foreach (TrackId target in outgoing[current])
                {
                    queue.Enqueue(target);
                }
            }
        }
        return false;
    }

    private IEnumerable<TrackId> FindRoots(TrackId start, IReadOnlyList<TrackRelation> relations)
    {
        HashSet<TrackId> visited = [];
        Queue<TrackId> queue = new([start]);
        Dictionary<TrackId, Track> tracksById = _tracks.ToDictionary(track => track.Id);
        ILookup<TrackId, TrackId> outgoing = relations.ToLookup(relation => relation.SourceTrackId, relation => relation.TargetTrackId);
        while (queue.TryDequeue(out TrackId current))
        {
            if (!visited.Add(current))
            {
                continue;
            }
            if (tracksById.TryGetValue(current, out Track? track) && track.Metadata.IsOriginal)
            {
                yield return current;
            }
            foreach (TrackId target in outgoing[current])
            {
                queue.Enqueue(target);
            }
        }
    }
}
