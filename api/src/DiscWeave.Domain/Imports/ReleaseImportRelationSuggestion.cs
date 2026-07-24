using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Interfaces;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Imports;

public sealed partial class ReleaseImportRelationSuggestion : IEntity<ReleaseImportRelationSuggestionId>
{
    private const int JsonPayloadMaxLength = 8192;
    private const int TokenMaxLength = 512;

#pragma warning disable IDE0044, IDE0052 // EF writes and reads these mapped backing fields during materialization.
    private string _reviewedRelationTypeCode = string.Empty;
    private ReleaseImportDraftTrackId? _reviewedTargetDraftTrackId;
    private TrackId? _reviewedTargetExistingTrackId;
    private string? _reviewedTargetKind;
    private Guid? _reviewedTargetTrackId;
    private ReleaseImportDraftTrackId? _reviewedSourceDraftTrackId;
    private TrackId? _reviewedSourceExistingTrackId;
    private string _reviewedSourceKind = string.Empty;
    private Guid _reviewedSourceTrackId;
    private string _reviewedPayloadJson = "{}";
    private string _suggestedRelationTypeCode = string.Empty;
    private ReleaseImportDraftTrackId? _suggestedTargetDraftTrackId;
    private TrackId? _suggestedTargetExistingTrackId;
    private string? _suggestedTargetKind;
    private Guid? _suggestedTargetTrackId;
    private ReleaseImportDraftTrackId? _suggestedSourceDraftTrackId;
    private TrackId? _suggestedSourceExistingTrackId;
    private string _suggestedSourceKind = string.Empty;
    private Guid _suggestedSourceTrackId;
    private string _suggestedPayloadJson = "{}";
#pragma warning restore IDE0044, IDE0052

    private ReleaseImportRelationSuggestion()
    {
        Token = string.Empty;
        ApplicationMode = ReleaseImportRelationSuggestionApplicationMode.BestEffort;
    }

    private ReleaseImportRelationSuggestion(
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportDraftId draftId,
        ReleaseImportRelationSuggestionId id,
        string token,
        int confidence,
        ReleaseImportRelationSuggestionPayload suggestedPayload,
        ReleaseImportRelationSuggestionApplicationMode applicationMode)
        : this()
    {
        CollectionId = collectionId;
        SessionId = sessionId;
        DraftId = draftId;
        Id = id;
        Token = ValidateToken(token);
        Confidence = ValidateConfidence(confidence);
        Decision = ReleaseImportRelationSuggestionDecision.Pending;
        ApplicationMode = Guard.DefinedEnum(
            applicationMode,
            nameof(applicationMode),
            "release_import_relation_suggestion.application_mode_invalid");
        SetSuggestedPayload(suggestedPayload);
        SetReviewedPayload(SuggestedPayload);
    }

    public CollectionId CollectionId { get; private set; }
    public ReleaseImportSessionId SessionId { get; private set; }
    public ReleaseImportDraftId DraftId { get; private set; }
    public ReleaseImportRelationSuggestionId Id { get; private set; }
    public string Token { get; private set; }
    public int Confidence { get; private set; }
    public ReleaseImportRelationSuggestionDecision Decision { get; private set; }
    public ReleaseImportRelationSuggestionApplicationMode ApplicationMode { get; private set; }
    public ReleaseImportRelationSuggestionPayload SuggestedPayload
    {
        get
        {
            _ = (
                _suggestedSourceKind,
                _suggestedSourceTrackId,
                _suggestedSourceDraftTrackId,
                _suggestedSourceExistingTrackId,
                _suggestedTargetKind,
                _suggestedTargetTrackId,
                _suggestedTargetDraftTrackId,
                _suggestedTargetExistingTrackId,
                _suggestedRelationTypeCode);

            return ImportJson.DeserializeValue<ReleaseImportRelationSuggestionPayload>(_suggestedPayloadJson);
        }
    }

    public ReleaseImportRelationSuggestionPayload ReviewedPayload
    {
        get
        {
            _ = (
                _reviewedSourceKind,
                _reviewedSourceTrackId,
                _reviewedSourceDraftTrackId,
                _reviewedSourceExistingTrackId,
                _reviewedTargetKind,
                _reviewedTargetTrackId,
                _reviewedTargetDraftTrackId,
                _reviewedTargetExistingTrackId,
                _reviewedRelationTypeCode);

            return ImportJson.DeserializeValue<ReleaseImportRelationSuggestionPayload>(_reviewedPayloadJson);
        }
    }

    public static ReleaseImportRelationSuggestion Create(
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportDraftId draftId,
        ReleaseImportRelationSuggestionId id,
        string token,
        int confidence,
        ReleaseImportRelationSuggestionPayload suggestedPayload)
    {
        return new ReleaseImportRelationSuggestion(
            collectionId,
            sessionId,
            draftId,
            id,
            token,
            confidence,
            suggestedPayload,
            ReleaseImportRelationSuggestionApplicationMode.BestEffort);
    }

    public static ReleaseImportRelationSuggestion CreateRequired(
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportDraftId draftId,
        ReleaseImportRelationSuggestionId id,
        string token,
        int confidence,
        ReleaseImportRelationSuggestionPayload suggestedPayload)
    {
        return new ReleaseImportRelationSuggestion(
            collectionId,
            sessionId,
            draftId,
            id,
            token,
            confidence,
            suggestedPayload,
            ReleaseImportRelationSuggestionApplicationMode.Required);
    }

    public void Accept(ReleaseImportRelationSuggestionPayload reviewedPayload)
    {
        SetReviewedPayload(reviewedPayload);
        Decision = ReleaseImportRelationSuggestionDecision.Accepted;
    }

    public void Reject()
    {
        Decision = ReleaseImportRelationSuggestionDecision.Rejected;
    }

    public void SetPending(ReleaseImportRelationSuggestionPayload reviewedPayload)
    {
        SetReviewedPayload(reviewedPayload);
        Decision = ReleaseImportRelationSuggestionDecision.Pending;
    }

    public void Reset()
    {
        SetReviewedPayload(SuggestedPayload);
        Decision = ReleaseImportRelationSuggestionDecision.Pending;
    }

    public void ReplaceRelationTypeCode(string oldCode, string replacementCode)
    {
        string normalizedOldCode = TrackRelationTypeCode.Required(
            oldCode,
            nameof(oldCode),
            "release_import_relation_suggestion.relation_type_code_required",
            "release_import_relation_suggestion.relation_type_code_invalid");
        string normalizedReplacementCode = TrackRelationTypeCode.Required(
            replacementCode,
            nameof(replacementCode),
            "release_import_relation_suggestion.relation_type_code_required",
            "release_import_relation_suggestion.relation_type_code_invalid");

        ReleaseImportRelationSuggestionPayload suggestedPayload = SuggestedPayload;
        if (suggestedPayload.RelationTypeCode == normalizedOldCode)
        {
            SetSuggestedPayload(suggestedPayload with { RelationTypeCode = normalizedReplacementCode });
        }

        ReleaseImportRelationSuggestionPayload reviewedPayload = ReviewedPayload;
        if (reviewedPayload.RelationTypeCode == normalizedOldCode)
        {
            SetReviewedPayload(reviewedPayload with { RelationTypeCode = normalizedReplacementCode });
        }
    }

    private void SetSuggestedPayload(ReleaseImportRelationSuggestionPayload suggestedPayload)
    {
        ReleaseImportRelationSuggestionPayload normalizedPayload = NormalizePayload(suggestedPayload);
        _suggestedSourceKind = normalizedPayload.Source.Kind.ToString();
        _suggestedSourceTrackId = normalizedPayload.Source.TrackId;
        _suggestedSourceDraftTrackId = normalizedPayload.Source.Kind == ReleaseImportRelationSuggestionEndpointKind.DraftTrack
            ? new ReleaseImportDraftTrackId(normalizedPayload.Source.TrackId)
            : null;
        _suggestedSourceExistingTrackId = normalizedPayload.Source.Kind == ReleaseImportRelationSuggestionEndpointKind.ExistingTrack
            ? new TrackId(normalizedPayload.Source.TrackId)
            : null;
        _suggestedTargetKind = normalizedPayload.Target?.Kind.ToString();
        _suggestedTargetTrackId = normalizedPayload.Target?.TrackId;
        _suggestedTargetDraftTrackId = normalizedPayload.Target?.Kind == ReleaseImportRelationSuggestionEndpointKind.DraftTrack
            ? new ReleaseImportDraftTrackId(normalizedPayload.Target.TrackId)
            : null;
        _suggestedTargetExistingTrackId = normalizedPayload.Target?.Kind == ReleaseImportRelationSuggestionEndpointKind.ExistingTrack
            ? new TrackId(normalizedPayload.Target.TrackId)
            : null;
        _suggestedRelationTypeCode = normalizedPayload.RelationTypeCode ?? string.Empty;
        _suggestedPayloadJson = SerializePayload(normalizedPayload);
    }

    private void SetReviewedPayload(ReleaseImportRelationSuggestionPayload reviewedPayload)
    {
        ReleaseImportRelationSuggestionPayload normalizedPayload = NormalizePayload(reviewedPayload);
        _reviewedSourceKind = normalizedPayload.Source.Kind.ToString();
        _reviewedSourceTrackId = normalizedPayload.Source.TrackId;
        _reviewedSourceDraftTrackId = normalizedPayload.Source.Kind == ReleaseImportRelationSuggestionEndpointKind.DraftTrack
            ? new ReleaseImportDraftTrackId(normalizedPayload.Source.TrackId)
            : null;
        _reviewedSourceExistingTrackId = normalizedPayload.Source.Kind == ReleaseImportRelationSuggestionEndpointKind.ExistingTrack
            ? new TrackId(normalizedPayload.Source.TrackId)
            : null;
        _reviewedTargetKind = normalizedPayload.Target?.Kind.ToString();
        _reviewedTargetTrackId = normalizedPayload.Target?.TrackId;
        _reviewedTargetDraftTrackId = normalizedPayload.Target?.Kind == ReleaseImportRelationSuggestionEndpointKind.DraftTrack
            ? new ReleaseImportDraftTrackId(normalizedPayload.Target.TrackId)
            : null;
        _reviewedTargetExistingTrackId = normalizedPayload.Target?.Kind == ReleaseImportRelationSuggestionEndpointKind.ExistingTrack
            ? new TrackId(normalizedPayload.Target.TrackId)
            : null;
        _reviewedRelationTypeCode = normalizedPayload.RelationTypeCode ?? string.Empty;
        _reviewedPayloadJson = SerializePayload(normalizedPayload);
    }

}
