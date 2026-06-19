using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Interfaces;
using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Review;

public sealed class CollectionReviewIssueState : IEntity<CollectionReviewIssueStateId>
{
    private const int StableKeyLength = 64;
    private const int TitleMaxLength = 512;
    private const int NoteMaxLength = 2048;

    private CollectionReviewIssueState()
    {
    }

    private CollectionReviewIssueState(
        CollectionId collectionId,
        CollectionReviewIssueStateId id,
        CollectionReviewIssueSnapshot snapshot,
        DateTimeOffset now)
    {
        CollectionId = collectionId;
        Id = id;
        StableKey = ValidateStableKey(snapshot.StableKey);
        Category = RequiredToken(snapshot.Category, nameof(snapshot.Category), "collection_review_issue.category_required");
        Subtype = RequiredToken(snapshot.Subtype, nameof(snapshot.Subtype), "collection_review_issue.subtype_required");
        Title = ValidateTitle(snapshot.Title);
        SourceDetector = RequiredToken(snapshot.SourceDetector, nameof(snapshot.SourceDetector), "collection_review_issue.source_detector_required");
        TargetsJson = ValidateTargetsJson(snapshot.TargetsJson);
        Status = CollectionReviewIssueStatus.Open;
        Reason = CollectionReviewIssueReason.Detected;
        CreatedAt = now;
        UpdatedAt = now;
        LastSeenAt = now;
    }

    public CollectionReviewIssueStateId Id { get; private set; }

    public CollectionId CollectionId { get; private set; }

    public string StableKey { get; private set; } = string.Empty;

    public string Category { get; private set; } = string.Empty;

    public string Subtype { get; private set; } = string.Empty;

    public string Title { get; private set; } = string.Empty;

    public string SourceDetector { get; private set; } = string.Empty;

    public string TargetsJson { get; private set; } = "[]";

    public CollectionReviewIssueStatus Status { get; private set; }

    public CollectionReviewIssueReason Reason { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public DateTimeOffset LastSeenAt { get; private set; }

    public DateTimeOffset ResolvedAt { get; private set; }

    public string Note { get; private set; } = string.Empty;

    public static CollectionReviewIssueState Create(
        CollectionId collectionId,
        CollectionReviewIssueStateId id,
        CollectionReviewIssueSnapshot snapshot,
        DateTimeOffset now)
    {
        return new CollectionReviewIssueState(collectionId, id, snapshot, now);
    }

    public void ApplySignal(CollectionReviewIssueSnapshot snapshot, DateTimeOffset now)
    {
        if (!string.Equals(StableKey, snapshot.StableKey, StringComparison.Ordinal))
        {
            throw new DomainException(
                "collection_review_issue.stable_key_mismatch",
                "Review issue signal stable key does not match persisted state");
        }

        Category = RequiredToken(snapshot.Category, nameof(snapshot.Category), "collection_review_issue.category_required");
        Subtype = RequiredToken(snapshot.Subtype, nameof(snapshot.Subtype), "collection_review_issue.subtype_required");
        Title = ValidateTitle(snapshot.Title);
        SourceDetector = RequiredToken(snapshot.SourceDetector, nameof(snapshot.SourceDetector), "collection_review_issue.source_detector_required");
        TargetsJson = ValidateTargetsJson(snapshot.TargetsJson);
        LastSeenAt = now;
        UpdatedAt = now;

        if (ShouldReopenReturnedSystemResolvedSignal())
        {
            Status = CollectionReviewIssueStatus.Open;
            Reason = CollectionReviewIssueReason.Detected;
            ResolvedAt = default;
        }
    }

    public void Dismiss(DateTimeOffset now, string note)
    {
        SetUserState(CollectionReviewIssueStatus.Dismissed, CollectionReviewIssueReason.DismissedByUser, now, note, resolvedAt: default);
    }

    public void ResolveByUser(DateTimeOffset now, string note)
    {
        SetUserState(CollectionReviewIssueStatus.Resolved, CollectionReviewIssueReason.ResolvedByUser, now, note, resolvedAt: now);
    }

    public void Reopen(DateTimeOffset now, string note)
    {
        SetUserState(CollectionReviewIssueStatus.Reopened, CollectionReviewIssueReason.ReopenedByUser, now, note, resolvedAt: default);
    }

    public void ResolveBySystem(DateTimeOffset now)
    {
        Status = CollectionReviewIssueStatus.Resolved;
        Reason = CollectionReviewIssueReason.ResolvedBySystem;
        UpdatedAt = now;
        ResolvedAt = now;
    }

    private void SetUserState(
        CollectionReviewIssueStatus status,
        CollectionReviewIssueReason reason,
        DateTimeOffset now,
        string note,
        DateTimeOffset resolvedAt)
    {
        Status = status;
        Reason = reason;
        UpdatedAt = now;
        ResolvedAt = resolvedAt;
        Note = ValidateNote(note);
    }

    private bool ShouldReopenReturnedSystemResolvedSignal()
    {
        // User-resolved issues are explicit triage state and stay hidden until the user reopens them.
        return Status == CollectionReviewIssueStatus.Resolved && Reason == CollectionReviewIssueReason.ResolvedBySystem;
    }

    private static string ValidateStableKey(string stableKey)
    {
        string value = Guard.RequiredText(stableKey, nameof(stableKey), "collection_review_issue.stable_key_required");
        return value.Length == StableKeyLength && value.All(IsLowerHex)
            ? value
            : throw new DomainException(
                "collection_review_issue.stable_key_invalid",
                "Review issue stable key must be a SHA-256 lowercase hex value");
    }

    private static string RequiredToken(string value, string fieldName, string code)
    {
        string token = Guard.RequiredText(value, fieldName, code);
        return token.Contains(' ', StringComparison.Ordinal)
            ? throw new DomainException(
                "collection_review_issue.token_invalid",
                $"{fieldName} cannot contain whitespace")
            : token;
    }

    private static string ValidateTitle(string title)
    {
        string value = Guard.RequiredText(title, nameof(title), "collection_review_issue.title_required");
        return value.Length <= TitleMaxLength
            ? value
            : throw new DomainException(
                "collection_review_issue.title_too_long",
                $"Review issue title must be at most {TitleMaxLength} characters");
    }

    private static string ValidateTargetsJson(string targetsJson)
    {
        return Guard.RequiredText(targetsJson, nameof(targetsJson), "collection_review_issue.targets_required");
    }

    private static string ValidateNote(string note)
    {
        if (string.IsNullOrWhiteSpace(note))
        {
            return string.Empty;
        }

        string trimmed = note.Trim();
        return trimmed.Length <= NoteMaxLength
            ? trimmed
            : throw new DomainException(
                "collection_review_issue.note_too_long",
                $"Review issue note must be at most {NoteMaxLength} characters");
    }

    private static bool IsLowerHex(char value)
    {
        return value is (>= '0' and <= '9') or (>= 'a' and <= 'f');
    }
}
