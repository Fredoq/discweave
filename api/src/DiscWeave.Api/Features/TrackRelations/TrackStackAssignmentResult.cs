using DiscWeave.Domain.Relations;

namespace DiscWeave.Api.Features.TrackRelations;

public sealed record TrackStackAssignmentResult
{
    public required TrackStackAssignmentFailure Failure { get; init; }
    public TrackRelation? Relation { get; init; }
    public required bool WasCreated { get; init; }

    public bool IsSuccess =>
        Failure == TrackStackAssignmentFailure.None;
}
