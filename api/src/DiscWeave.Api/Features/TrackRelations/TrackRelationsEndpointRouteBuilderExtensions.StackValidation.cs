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
                    "Target track belongs to another stack"),
            TrackStackAssignmentFailure.CurrentOriginalNotRoot =>
                EndpointErrors.Conflict(
                    "track_relation.stack_current_original_invalid",
                    "Current track is no longer the original of a stack"),
            TrackStackAssignmentFailure.NewOriginalOutsideStack =>
                EndpointErrors.Conflict(
                    "track_relation.stack_new_original_invalid",
                    "New original must be a member of this stack or a standalone track"),
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
