using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Imports;

public sealed partial class ReleaseImportDraft
{
    private void ApplyInitialEditableFields(ReleaseImportDraftEditableFields fields)
    {
        ArgumentNullException.ThrowIfNull(fields);
        ApplyEditableFields(NormalizeEditableFields(fields));
    }

    private void ApplyEditableFieldsAtomically(ReleaseImportDraftEditableFields fields)
    {
        ArgumentNullException.ThrowIfNull(fields);
        NormalizedEditableFields normalized = NormalizeEditableFields(fields);
        if (HasSameEditableFields(normalized))
        {
            return;
        }

        long? nextRevision = SourceKind == ReleaseImportSourceKind.ExternalMetadata
            ? NextExternalReviewRevision()
            : null;
        ApplyEditableFields(normalized);
        if (nextRevision is long revision)
        {
            CommitExternalReviewRevision(revision);
        }
    }

    private static NormalizedEditableFields NormalizeEditableFields(ReleaseImportDraftEditableFields fields)
    {
        string title = Guard.RequiredText(fields.Title, nameof(fields.Title), "release_import.title_required");
        string type = string.IsNullOrWhiteSpace(fields.Type) ? "unknown" : fields.Type.Trim();
        string? catalogNumberValue = OptionalTextOrNull(fields.CatalogNumber);
        string? labelNameValue = OptionalTextOrNull(fields.LabelName);
        string? catalogNumber = TrimOrNull(catalogNumberValue);
        string? labelName = TrimOrNull(labelNameValue);
        DateOnly? releaseDate = OptionalValueOrNull(fields.ReleaseDate);
        int? year = OptionalValueOrNull(fields.Year) ?? releaseDate?.Year;
        string? coverPath = TrimOrNull(OptionalTextOrNull(fields.CoverPath));
        string artistNamesJson = ImportJson.Serialize(fields.ArtistNames);
        string artistCreditsJson = ImportJson.Serialize(NormalizeArtistCredits(
            fields.ArtistCredits,
            fields.ArtistNames,
            fields.SelectedArtistIds));
        string labelsJson = ImportJson.Serialize(NormalizeLabels(
            fields.Labels,
            labelNameValue,
            catalogNumberValue));
        string selectedArtistIdsJson = ImportJson.Serialize(fields.SelectedArtistIds);
        string genresJson = ImportJson.Serialize(fields.Genres);
        string tagsJson = ImportJson.Serialize(fields.Tags);
        string externalSourcesJson = SerializeExternalSources(fields.ExternalSources);
        string issuesJson = ImportJson.Serialize(fields.Issues);
        ReleaseImportDraftStatus status = fields.Issues.Any(
            issue => issue.Severity == ImportReviewSeverity.Error)
            ? ReleaseImportDraftStatus.NeedsReview
            : ReleaseImportDraftStatus.Ready;

        return new NormalizedEditableFields(
            title,
            type,
            catalogNumber,
            labelName,
            releaseDate,
            year,
            fields.IsVariousArtists,
            fields.NotOnLabel,
            coverPath,
            fields.CreateCatalogTracks,
            artistNamesJson,
            artistCreditsJson,
            labelsJson,
            selectedArtistIdsJson,
            genresJson,
            tagsJson,
            externalSourcesJson,
            issuesJson,
            status);
    }

    private bool HasSameEditableFields(NormalizedEditableFields fields)
    {
        return Title == fields.Title &&
            Type == fields.Type &&
            CatalogNumber == fields.CatalogNumber &&
            LabelName == fields.LabelName &&
            ReleaseDate == fields.ReleaseDate &&
            Year == fields.Year &&
            IsVariousArtists == fields.IsVariousArtists &&
            NotOnLabel == fields.NotOnLabel &&
            CoverPath == fields.CoverPath &&
            CreateCatalogTracks == fields.CreateCatalogTracks &&
            _artistNamesJson == fields.ArtistNamesJson &&
            _artistCreditsJson == fields.ArtistCreditsJson &&
            _labelsJson == fields.LabelsJson &&
            _selectedArtistIdsJson == fields.SelectedArtistIdsJson &&
            _genresJson == fields.GenresJson &&
            _tagsJson == fields.TagsJson &&
            _externalSourcesJson == fields.ExternalSourcesJson &&
            _issuesJson == fields.IssuesJson &&
            Status == fields.Status;
    }

    private void ApplyEditableFields(NormalizedEditableFields fields)
    {
        Title = fields.Title;
        Type = fields.Type;
        CatalogNumber = fields.CatalogNumber;
        LabelName = fields.LabelName;
        ReleaseDate = fields.ReleaseDate;
        Year = fields.Year;
        IsVariousArtists = fields.IsVariousArtists;
        NotOnLabel = fields.NotOnLabel;
        CoverPath = fields.CoverPath;
        CreateCatalogTracks = fields.CreateCatalogTracks;
        _artistNamesJson = fields.ArtistNamesJson;
        _artistCreditsJson = fields.ArtistCreditsJson;
        _labelsJson = fields.LabelsJson;
        _selectedArtistIdsJson = fields.SelectedArtistIdsJson;
        _genresJson = fields.GenresJson;
        _tagsJson = fields.TagsJson;
        _externalSourcesJson = fields.ExternalSourcesJson;
        _issuesJson = fields.IssuesJson;
        Status = fields.Status;
    }

    private sealed record NormalizedEditableFields(
        string Title,
        string Type,
        string? CatalogNumber,
        string? LabelName,
        DateOnly? ReleaseDate,
        int? Year,
        bool IsVariousArtists,
        bool NotOnLabel,
        string? CoverPath,
        bool CreateCatalogTracks,
        string ArtistNamesJson,
        string ArtistCreditsJson,
        string LabelsJson,
        string SelectedArtistIdsJson,
        string GenresJson,
        string TagsJson,
        string ExternalSourcesJson,
        string IssuesJson,
        ReleaseImportDraftStatus Status);
}
