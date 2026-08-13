using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Interfaces;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Imports;

public sealed partial class ReleaseImportDraft : IEntity<ReleaseImportDraftId>
{
    private string _artistNamesJson = "[]";
    private string _artistCreditsJson = "[]";
    private string _externalSourcesJson = "[]";
    private string _genresJson = "[]";
    private string _issuesJson = "[]";
    private string _labelsJson = "[]";
    private string _selectedArtistIdsJson = "[]";
    private string _tagsJson = "[]";
#pragma warning disable IDE0044
    private string? _sourcePath;
    private string? _relativePath;
#pragma warning restore IDE0044

    private ReleaseImportDraft()
    {
        Title = string.Empty;
        Type = "unknown";
    }

    private ReleaseImportDraft(
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportDraftId id,
        ReleaseImportSourceKind sourceKind,
        string? sourcePath,
        string? relativePath)
        : this()
    {
        CollectionId = collectionId;
        SessionId = sessionId;
        Id = id;
        SourceKind = sourceKind;
        _sourcePath = sourcePath;
        _relativePath = relativePath;
        Status = ReleaseImportDraftStatus.NeedsReview;
    }

    public CollectionId CollectionId { get; private set; }
    public ReleaseImportSessionId SessionId { get; private set; }
    public ReleaseImportDraftId Id { get; private set; }
    public ReleaseImportSourceKind SourceKind { get; private set; }
    public IOptionalValue<string> SourcePath => _sourcePath is null ? Optional.Missing<string>() : Optional.From(_sourcePath);
    public IOptionalValue<string> RelativePath => _relativePath is null ? Optional.Missing<string>() : Optional.From(_relativePath);
    public ReleaseImportDraftStatus Status { get; private set; }
    public string Title { get; private set; }
    public string Type { get; private set; }
    public string? CatalogNumber { get; private set; }
    public string? LabelName { get; private set; }
    public DateOnly? ReleaseDate { get; private set; }
    public int? Year { get; private set; }
    public bool IsVariousArtists { get; private set; }
    public bool NotOnLabel { get; private set; }
    public string? CoverPath { get; private set; }
    public string? CoverFileName { get; private set; }
    public string? CoverExtension { get; private set; }
    public string? CoverContentType { get; private set; }
    public long? CoverSizeBytes { get; private set; }
    public byte[]? CoverContent { get; private set; }
    public ReleaseId? ConfirmedReleaseId { get; private set; }
    public bool CreateCatalogTracks { get; private set; } = true;
    public IReadOnlyList<string> ArtistNames => ImportJson.Deserialize<string>(_artistNamesJson);
    public IReadOnlyList<ReleaseImportArtistCredit> ArtistCredits => ImportJson.Deserialize<ReleaseImportArtistCredit>(_artistCreditsJson);
    public IReadOnlyList<ReleaseImportLabel> Labels => ImportJson.Deserialize<ReleaseImportLabel>(_labelsJson);
    public IReadOnlyList<Guid> SelectedArtistIds => ImportJson.Deserialize<Guid>(_selectedArtistIdsJson);
    public IReadOnlyList<string> Genres => ImportJson.Deserialize<string>(_genresJson);
    public IReadOnlyList<string> Tags => ImportJson.Deserialize<string>(_tagsJson);
    public IReadOnlyList<ReleaseImportProviderReference> ExternalSources => DeserializeExternalSources(_externalSourcesJson);
    public IReadOnlyList<ImportReviewIssue> Issues => ImportJson.Deserialize<ImportReviewIssue>(_issuesJson);

    public static ReleaseImportDraft Create(CollectionId collectionId, ReleaseImportSessionId sessionId, ReleaseImportDraftId id, string sourcePath, string relativePath)
    {
        return CreateLocalFiles(collectionId, sessionId, id, sourcePath, relativePath);
    }

    public static ReleaseImportDraft CreateLocalFiles(
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportDraftId id,
        string sourcePath,
        string relativePath)
    {
        return new ReleaseImportDraft(
            collectionId,
            sessionId,
            id,
            ReleaseImportSourceKind.LocalFiles,
            Guard.RequiredText(sourcePath, nameof(sourcePath), "release_import.source_path_required"),
            relativePath);
    }

    public static ReleaseImportDraft CreateExternalMetadata(
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportDraftId id)
    {
        return CreateExternalMetadata(
            collectionId,
            sessionId,
            id,
            ReleaseImportLocalProvenanceSelection.Empty());
    }

    public void UpdateEditableFields(ReleaseImportDraftEditableFields fields)
    {
        EnsureEditable();
        ApplyEditableFieldsAtomically(fields);
    }

    public void SetCoverArtifact(ReleaseImportCoverArtifact? artifact)
    {
        EnsureEditable();

        string? fileName = artifact is null ? null : TrimOrNull(artifact.FileName);
        string? extension = artifact is null ? null : TrimOrNull(artifact.Extension);
        string? contentType = artifact is null ? null : TrimOrNull(artifact.ContentType);
        byte[]? content = artifact is null ? null : [.. artifact.Content];
        long? sizeBytes = content?.LongLength;
        bool changed = CoverFileName != fileName ||
            CoverExtension != extension ||
            CoverContentType != contentType ||
            CoverSizeBytes != sizeBytes ||
            !SameContent(CoverContent, content);
        if (!changed)
        {
            return;
        }

        long? nextRevision = SourceKind == ReleaseImportSourceKind.ExternalMetadata
            ? NextExternalReviewRevision()
            : null;
        CoverFileName = fileName;
        CoverExtension = extension;
        CoverContentType = contentType;
        CoverContent = content;
        CoverSizeBytes = sizeBytes;
        if (nextRevision is long revision)
        {
            CommitExternalReviewRevision(revision);
        }
    }

    public void Confirm(ReleaseId releaseId)
    {
        if (Status == ReleaseImportDraftStatus.Ready)
        {
            ConfirmedReleaseId = releaseId;
            Status = ReleaseImportDraftStatus.Confirmed;
            return;
        }

        if (Status == ReleaseImportDraftStatus.Confirmed)
        {
            throw new DomainException("release_import_draft.confirmed", "Confirmed release import drafts cannot be confirmed again");
        }

        if (Status == ReleaseImportDraftStatus.Skipped)
        {
            throw new DomainException("release_import_draft.skipped", "Skipped release import drafts cannot be confirmed");
        }

        throw new DomainException("release_import_draft.not_ready", "Only ready release import drafts can be confirmed");
    }

    public void Skip()
    {
        if (Status == ReleaseImportDraftStatus.Confirmed)
        {
            throw new DomainException("release_import_draft.confirmed", "Confirmed release import drafts cannot be skipped");
        }

        if (Status == ReleaseImportDraftStatus.Skipped)
        {
            throw new DomainException("release_import_draft.skipped", "Skipped release import drafts cannot be skipped again");
        }

        Status = ReleaseImportDraftStatus.Skipped;
    }

    private void EnsureEditable()
    {
        if (Status == ReleaseImportDraftStatus.Confirmed)
        {
            throw new DomainException("release_import_draft.confirmed", "Confirmed release import drafts cannot be edited");
        }

        if (Status == ReleaseImportDraftStatus.Skipped)
        {
            throw new DomainException("release_import_draft.skipped", "Skipped release import drafts cannot be edited");
        }
    }

    private static string? TrimOrNull(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static string? OptionalTextOrNull(IOptionalValue<string> value)
    {
        return value is PresentOptionalValue<string> present ? present.Value : null;
    }

    private static T? OptionalValueOrNull<T>(IOptionalValue<T> value)
        where T : struct
    {
        return value is PresentOptionalValue<T> present ? present.Value : null;
    }

    private static bool SameContent(byte[]? left, byte[]? right)
    {
        return left is null ? right is null : right is not null && left.AsSpan().SequenceEqual(right);
    }

}
