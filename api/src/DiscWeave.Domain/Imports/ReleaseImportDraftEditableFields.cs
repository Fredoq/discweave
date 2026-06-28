using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Domain.Catalog;

namespace DiscWeave.Domain.Imports;

public sealed record ReleaseImportDraftEditableFields(
    string Title,
    string Type,
    IOptionalValue<string> CatalogNumber,
    IOptionalValue<string> LabelName,
    IOptionalValue<DateOnly> ReleaseDate,
    IOptionalValue<int> Year,
    bool IsVariousArtists,
    bool NotOnLabel,
    IOptionalValue<string> CoverPath,
    IReadOnlyList<string> ArtistNames,
    IReadOnlyList<ReleaseImportArtistCredit> ArtistCredits,
    IReadOnlyList<ReleaseImportLabel> Labels,
    IReadOnlyList<Guid> SelectedArtistIds,
    IReadOnlyList<string> Genres,
    IReadOnlyList<string> Tags,
    IReadOnlyList<ExternalSourceReference> ExternalSources,
    bool CreateCatalogTracks,
    IReadOnlyList<ImportReviewIssue> Issues);
