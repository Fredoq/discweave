using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Application.Catalog.TrackStacks;

public sealed class TrackStackProjection
{
    public TrackStackProjection(
        Track original,
        IReadOnlyList<TrackStackMemberProjection> members,
        IReadOnlyList<IReadOnlyList<TrackId>> cyclePaths)
    {
        Original = original;
        Members = members;
        CyclePaths = cyclePaths;
    }

    public Track Original { get; }
    public IReadOnlyList<TrackStackMemberProjection> Members { get; }
    public IReadOnlyList<IReadOnlyList<TrackId>> CyclePaths { get; }
}
