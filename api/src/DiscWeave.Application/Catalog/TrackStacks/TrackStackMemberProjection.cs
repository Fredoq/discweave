using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;

namespace DiscWeave.Application.Catalog.TrackStacks;

public sealed class TrackStackMemberProjection
{
    public TrackStackMemberProjection(
        Track track,
        TrackRelationTypeCodeValue relationType,
        int depth,
        bool isDirect)
    {
        Track = track;
        RelationType = relationType;
        Depth = depth;
        IsDirect = isDirect;
    }

    public Track Track { get; }
    public TrackRelationTypeCodeValue RelationType { get; }
    public int Depth { get; }
    public bool IsDirect { get; }
}
