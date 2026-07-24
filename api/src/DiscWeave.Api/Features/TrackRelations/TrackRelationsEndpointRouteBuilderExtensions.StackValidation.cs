using DiscWeave.Api.Http;

namespace DiscWeave.Api.Features.TrackRelations;

public static partial class TrackRelationsEndpointRouteBuilderExtensions
{
    internal static IResult StackRelationIdentityConflict()
    {
        return EndpointErrors.Conflict(
            TrackRelationDuplicateCode,
            TrackRelationDuplicateMessage);
    }

    private static IResult MapStackAssignmentFailure(
        TrackStackAssignmentFailure failure)
    {
        return failure switch
        {
            TrackStackAssignmentFailure.SourceCollectionMismatch or
                TrackStackAssignmentFailure.TargetCollectionMismatch =>
                EndpointErrors.NotFound(
                    TrackRelationTrackConflictCode,
                    TrackRelationTrackConflictMessage),
            TrackStackAssignmentFailure.SelfRelation =>
                EndpointErrors.BadRequest(
                    "track_relation.stack_self_relation",
                    "Track relation cannot reference the same track twice"),
            TrackStackAssignmentFailure.RelationTypeNotConfigured =>
                EndpointErrors.BadRequest(
                    "track_relation.stack_type_invalid",
                    "Track relation type is not configured for track stacks"),
            TrackStackAssignmentFailure.Cycle =>
                EndpointErrors.Conflict(
                    "track_relation.stack_cycle",
                    "Track relation would create a stack cycle"),
            TrackStackAssignmentFailure.SourceNotStandalone =>
                EndpointErrors.Conflict(
                    "track_relation.stack_source_not_standalone",
                    "Source track is not standalone"),
            TrackStackAssignmentFailure.TargetNotOriginal =>
                EndpointErrors.Conflict(
                    "track_relation.stack_target_not_original",
                    "Target track is not an original stack root"),
            TrackStackAssignmentFailure.TargetNotStandalone =>
                EndpointErrors.Conflict(
                    "track_relation.stack_target_not_standalone",
                    "Target track already has stack members"),
            TrackStackAssignmentFailure.None =>
                throw new InvalidOperationException(
                    "A successful stack validation cannot be mapped to an error"),
            _ => throw new ArgumentOutOfRangeException(
                nameof(failure),
                failure,
                "Unknown stack validation failure")
        };
    }
}
