namespace DiscWeave.Api.Features.ReviewWorkbench;

public static partial class ReviewWorkbenchEndpointRouteBuilderExtensions
{
    private static string FocusName(string subtype)
    {
        return subtype switch
        {
            ReviewWorkbenchSubtypes.ReleasesMissingYearOrDate or
            ReviewWorkbenchSubtypes.ReleasesMissingLabel or
            ReviewWorkbenchSubtypes.TracksMissingDuration or
            ReviewWorkbenchSubtypes.OwnedItemsMissingCondition or
            ReviewWorkbenchSubtypes.OwnedItemsMissingStorageLocation or
            ReviewWorkbenchSubtypes.LocalAudioFilesMissingCodec or
            ReviewWorkbenchSubtypes.PhysicalWithoutDigital or
            ReviewWorkbenchSubtypes.LossyWithoutLossless or
            ReviewWorkbenchSubtypes.WantedNotOwned => "optional",
            _ => "actionable"
        };
    }
}
