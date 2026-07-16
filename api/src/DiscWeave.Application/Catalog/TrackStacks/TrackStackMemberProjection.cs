using DiscWeave.Domain.Catalog;

namespace DiscWeave.Application.Catalog.TrackStacks;

public sealed class TrackStackMemberProjection
{
    public TrackStackMemberProjection(
        Track track,
        string relationType,
        int depth,
        bool isDirect)
    {
        Track = track;
        RelationType = relationType;
        Depth = depth;
        IsDirect = isDirect;
    }

    public Track Track { get; }
    public string RelationType { get; }
    public int Depth { get; }
    public bool IsDirect { get; }
}
