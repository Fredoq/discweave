using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Imports;

public sealed record DraftTrackEditableFields(
    int? Position,
    string? Disc,
    string? Side,
    string Title,
    TimeSpan? Duration,
    int? VersionYear,
    IReadOnlyList<string> ArtistNames,
    IReadOnlyList<ReleaseImportArtistCredit> ArtistCredits,
    bool InheritReleaseArtistCredits,
    IReadOnlyList<Guid> SelectedArtistIds,
    ReleaseImportTrackMode TrackMode,
    TrackId? SelectedTrackId,
    bool IsSkipped,
    IReadOnlyList<ImportReviewIssue> Issues);
