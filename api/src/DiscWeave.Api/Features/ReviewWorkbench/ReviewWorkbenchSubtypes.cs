namespace DiscWeave.Api.Features.ReviewWorkbench;

internal static class ReviewWorkbenchSubtypes
{
    public const string DuplicateReleases = "duplicateReleases";
    public const string DuplicateTracks = "duplicateTracks";
    public const string DuplicateDigitalFileIdentities = "duplicateDigitalFileIdentities";
    public const string ReleasesMissingYearOrDate = "releasesMissingYearOrDate";
    public const string ReleasesMissingLabel = "releasesMissingLabel";
    public const string TracksMissingDuration = "tracksMissingDuration";
    public const string OwnedItemsMissingCondition = "ownedItemsMissingCondition";
    public const string OwnedItemsMissingStorageLocation = "ownedItemsMissingStorageLocation";
    public const string OwnedItemsMissingDigitalFormat = "ownedItemsMissingDigitalFormat";
    public const string DigitalCopiesMissingLinkedFiles = "digitalCopiesMissingLinkedFiles";
    public const string LocalAudioFilesMissingFormat = "localAudioFilesMissingFormat";
    public const string LocalAudioFilesMissingCodec = "localAudioFilesMissingCodec";
    public const string LocalAudioFilesUnmapped = "localAudioFilesUnmapped";
    public const string PhysicalWithoutDigital = "physicalWithoutDigital";
    public const string LossyWithoutLossless = "lossyWithoutLossless";
    public const string WantedNotOwned = "wantedNotOwned";
    public const string NeedsDigitization = "needsDigitization";
    public const string VariantTitleWithoutRelation = "variantTitleWithoutRelation";
    public const string ConfirmedImportWarnings = "confirmedImportWarnings";
    public const string DuplicateImportOutcomes = "duplicateImportOutcomes";
    public const string SkippedRelationSuggestions = "skippedRelationSuggestions";
}
