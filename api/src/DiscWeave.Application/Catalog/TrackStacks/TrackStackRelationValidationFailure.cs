namespace DiscWeave.Application.Catalog.TrackStacks;

public enum TrackStackRelationValidationFailure
{
    None,
    RelationTypeNotConfigured,
    Cycle,
    SourceNotStandalone,
    TargetNotOriginal,
    TargetNotStandalone
}
