using DiscWeave.Application.Catalog.TrackStacks;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed class TrackStackGraphTests
{
    [Fact(DisplayName = "Track stack projection handles deep cyclic relation chains without recursion")]
    public void Track_stack_projection_handles_deep_cyclic_relation_chains_without_recursion()
    {
        const int trackCount = 20_000;
        var collectionId = CollectionId.New();
        Track[] tracks =
        [
            .. Enumerable.Range(0, trackCount)
                .Select(index => Track.Create(
                    collectionId,
                    TrackId.New(),
                    $"Track {index}"))
        ];
        TrackRelation[] relations =
        [
            .. Enumerable.Range(1, trackCount - 1)
                .Select(index => TrackRelation.Create(
                    TrackRelationId.New(),
                    collectionId,
                    tracks[index].Id,
                    tracks[index - 1].Id,
                    "versionOf")),
            TrackRelation.Create(
                TrackRelationId.New(),
                collectionId,
                tracks[0].Id,
                tracks[^1].Id,
                "remixOf")
        ];
        var graph = new TrackStackGraph(tracks, relations);

        TrackStackProjection projection = graph.Project(tracks[0]);

        Assert.Equal(trackCount - 1, projection.Members.Count);
        Assert.NotEmpty(projection.CyclePaths);
    }
}
