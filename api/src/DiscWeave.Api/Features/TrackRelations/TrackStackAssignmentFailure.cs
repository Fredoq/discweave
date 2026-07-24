namespace DiscWeave.Api.Features.TrackRelations;

public enum TrackStackAssignmentFailure
{
    None = 0,
    SourceCollectionMismatch,
    TargetCollectionMismatch,
    SelfRelation,
    RelationTypeNotConfigured,
    Cycle,
    SourceNotStandalone,
    TargetNotOriginal,
    TargetNotStandalone
}
