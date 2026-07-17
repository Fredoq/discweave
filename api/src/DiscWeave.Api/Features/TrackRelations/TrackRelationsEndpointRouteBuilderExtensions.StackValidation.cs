using DiscWeave.Api.Http;
using DiscWeave.Application.Catalog.TrackStacks;

namespace DiscWeave.Api.Features.TrackRelations;

public static partial class TrackRelationsEndpointRouteBuilderExtensions
{
    internal static IResult StackRelationIdentityConflict()
    {
        return EndpointErrors.Conflict(
            TrackRelationDuplicateCode,
            TrackRelationDuplicateMessage);
    }

    private static IResult MapStackValidationFailure(
        TrackStackRelationValidationFailure failure)
    {
        return failure switch
        {
            TrackStackRelationValidationFailure.RelationTypeNotConfigured =>
                EndpointErrors.BadRequest(
                    "track_relation.stack_type_invalid",
                    "Track relation type is not configured for track stacks"),
            TrackStackRelationValidationFailure.Cycle =>
                EndpointErrors.Conflict(
                    "track_relation.stack_cycle",
                    "Track relation would create a stack cycle"),
            TrackStackRelationValidationFailure.SourceNotStandalone =>
                EndpointErrors.Conflict(
                    "track_relation.stack_source_not_standalone",
                    "Source track is not standalone"),
            TrackStackRelationValidationFailure.TargetNotOriginal =>
                EndpointErrors.Conflict(
                    "track_relation.stack_target_not_original",
                    "Target track is not an original stack root"),
            TrackStackRelationValidationFailure.TargetNotStandalone =>
                EndpointErrors.Conflict(
                    "track_relation.stack_target_not_standalone",
                    "Target track already has stack members"),
            TrackStackRelationValidationFailure.None =>
                throw new InvalidOperationException(
                    "A successful stack validation cannot be mapped to an error"),
            _ => throw new ArgumentOutOfRangeException(
                nameof(failure),
                failure,
                "Unknown stack validation failure")
        };
    }
}
