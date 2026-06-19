namespace DiscWeave.Api.Features.ReviewWorkbench;

internal static class ReviewWorkbenchCategories
{
    public const string DuplicateCandidates = "duplicateCandidates";
    public const string MissingMetadata = "missingMetadata";
    public const string FormatGaps = "formatGaps";
    public const string RelationGaps = "relationGaps";
    public const string ImportCleanup = "importCleanup";

    public static readonly string[] All =
    [
        DuplicateCandidates,
        MissingMetadata,
        FormatGaps,
        RelationGaps,
        ImportCleanup
    ];
}
