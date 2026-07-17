using DiscWeave.Domain.Catalog;

namespace DiscWeave.Application.Catalog.TrackStacks;

public sealed class TrackStackRelationValidator
{
    private readonly StringComparer _relationTypeComparer = StringComparer.Ordinal;

    public TrackStackRelationValidationFailure ValidateNew(
        Track source,
        Track target,
        string relationType,
        IReadOnlyCollection<string> configuredRelationTypeCodes,
        TrackStackGraph graph,
        bool markTargetAsOriginal)
    {
        ArgumentNullException.ThrowIfNull(source);
        ArgumentNullException.ThrowIfNull(target);
        ArgumentException.ThrowIfNullOrWhiteSpace(relationType);
        ArgumentNullException.ThrowIfNull(configuredRelationTypeCodes);
        ArgumentNullException.ThrowIfNull(graph);

        return true switch
        {
            _ when !configuredRelationTypeCodes.Contains(
                relationType,
                _relationTypeComparer) =>
                TrackStackRelationValidationFailure.RelationTypeNotConfigured,
            _ when graph.WouldCreateCycle(source.Id, target.Id) =>
                TrackStackRelationValidationFailure.Cycle,
            _ when !graph.IsStandalone(source.Id) =>
                TrackStackRelationValidationFailure.SourceNotStandalone,
            _ when !markTargetAsOriginal && !target.Metadata.IsOriginal =>
                TrackStackRelationValidationFailure.TargetNotOriginal,
            _ when markTargetAsOriginal && !graph.IsStandalone(target.Id) =>
                TrackStackRelationValidationFailure.TargetNotStandalone,
            _ => TrackStackRelationValidationFailure.None
        };
    }
}
