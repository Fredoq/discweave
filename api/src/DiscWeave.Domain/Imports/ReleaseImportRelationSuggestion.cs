using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Interfaces;
using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Imports;

public sealed class ReleaseImportRelationSuggestion : IEntity<ReleaseImportRelationSuggestionId>
{
    private const int JsonPayloadMaxLength = 8192;
    private const int RelationTypeCodeMaxLength = 64;
    private const int TokenMaxLength = 512;

#pragma warning disable IDE0044, IDE0052 // EF writes and reads these mapped backing fields during materialization.
    private string _reviewedRelationTypeCode = string.Empty;
    private ReleaseImportDraftTrackId? _reviewedTargetDraftTrackId;
    private TrackId? _reviewedTargetExistingTrackId;
    private string? _reviewedTargetKind;
    private Guid? _reviewedTargetTrackId;
    private string _reviewedSourceKind = string.Empty;
    private ReleaseImportDraftTrackId _reviewedSourceTrackId;
    private string _reviewedPayloadJson = "{}";
    private string _suggestedRelationTypeCode = string.Empty;
    private ReleaseImportDraftTrackId? _suggestedTargetDraftTrackId;
    private TrackId? _suggestedTargetExistingTrackId;
    private string? _suggestedTargetKind;
    private Guid? _suggestedTargetTrackId;
    private string _suggestedSourceKind = string.Empty;
    private ReleaseImportDraftTrackId _suggestedSourceTrackId;
    private string _suggestedPayloadJson = "{}";
#pragma warning restore IDE0044, IDE0052

    private ReleaseImportRelationSuggestion()
    {
        Token = string.Empty;
    }

    private ReleaseImportRelationSuggestion(
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportDraftId draftId,
        ReleaseImportRelationSuggestionId id,
        string token,
        int confidence,
        ReleaseImportRelationSuggestionPayload suggestedPayload)
        : this()
    {
        CollectionId = collectionId;
        SessionId = sessionId;
        DraftId = draftId;
        Id = id;
        Token = ValidateToken(token);
        Confidence = ValidateConfidence(confidence);
        Decision = ReleaseImportRelationSuggestionDecision.Pending;
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
    public ReleaseImportRelationSuggestionPayload SuggestedPayload => ImportJson.DeserializeValue<ReleaseImportRelationSuggestionPayload>(_suggestedPayloadJson);
    public ReleaseImportRelationSuggestionPayload ReviewedPayload => ImportJson.DeserializeValue<ReleaseImportRelationSuggestionPayload>(_reviewedPayloadJson);

    public static ReleaseImportRelationSuggestion Create(
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportDraftId draftId,
        ReleaseImportRelationSuggestionId id,
        string token,
        int confidence,
        ReleaseImportRelationSuggestionPayload suggestedPayload)
    {
        return new ReleaseImportRelationSuggestion(collectionId, sessionId, draftId, id, token, confidence, suggestedPayload);
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

    public void Reset()
    {
        SetReviewedPayload(SuggestedPayload);
        Decision = ReleaseImportRelationSuggestionDecision.Pending;
    }

    private void SetSuggestedPayload(ReleaseImportRelationSuggestionPayload suggestedPayload)
    {
        ReleaseImportRelationSuggestionPayload normalizedPayload = NormalizePayload(suggestedPayload);
        _suggestedSourceKind = normalizedPayload.Source.Kind.ToString();
        _suggestedSourceTrackId = new ReleaseImportDraftTrackId(normalizedPayload.Source.TrackId);
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
        _reviewedSourceTrackId = new ReleaseImportDraftTrackId(normalizedPayload.Source.TrackId);
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

    private static ReleaseImportRelationSuggestionPayload NormalizePayload(ReleaseImportRelationSuggestionPayload payload)
    {
        if (payload is null)
        {
            throw new DomainException(
                "release_import_relation_suggestion.payload_required",
                "Release import relation suggestion payload is required");
        }

        ReleaseImportRelationSuggestionEndpoint source = ValidateEndpoint(
            payload.Source,
            nameof(payload.Source),
            "source",
            requireDraftTrack: true);
        ReleaseImportRelationSuggestionEndpoint? target = payload.Target is null
            ? null
            : ValidateEndpoint(payload.Target, nameof(payload.Target), "target", requireDraftTrack: false);

        return new ReleaseImportRelationSuggestionPayload(
            source,
            target,
            ValidateRelationTypeCode(payload.RelationTypeCode));
    }

    private static ReleaseImportRelationSuggestionEndpoint ValidateEndpoint(
        ReleaseImportRelationSuggestionEndpoint? endpoint,
        string fieldName,
        string codePrefix,
        bool requireDraftTrack)
    {
        if (endpoint is null)
        {
            throw new DomainException(
                $"release_import_relation_suggestion.{codePrefix}_required",
                $"{fieldName} is required");
        }

        ReleaseImportRelationSuggestionEndpointKind kind = Guard.DefinedEnum(
            endpoint.Kind,
            fieldName,
            $"release_import_relation_suggestion.{codePrefix}_kind_invalid");
        ReleaseImportRelationSuggestionEndpointKind normalizedKind = requireDraftTrack && kind != ReleaseImportRelationSuggestionEndpointKind.DraftTrack
            ? throw new DomainException(
                $"release_import_relation_suggestion.{codePrefix}_kind_invalid",
                $"{fieldName} must be a draft track endpoint")
            : kind;

        return endpoint.TrackId == Guid.Empty
            ? throw new DomainException(
                $"release_import_relation_suggestion.{codePrefix}_track_required",
                $"{fieldName} track id is required")
            : new ReleaseImportRelationSuggestionEndpoint(normalizedKind, endpoint.TrackId);
    }

    private static string ValidateToken(string token)
    {
        string trimmed = Guard.RequiredText(token, nameof(token), "release_import_relation_suggestion.token_required");
        return trimmed.Length > TokenMaxLength
            ? throw new DomainException(
                "release_import_relation_suggestion.token_too_long",
                $"Release import relation suggestion token must be at most {TokenMaxLength} characters")
            : trimmed;
    }

    private static string ValidateRelationTypeCode(string? relationTypeCode)
    {
        string trimmed = Guard.RequiredText(
            relationTypeCode ?? string.Empty,
            nameof(relationTypeCode),
            "release_import_relation_suggestion.relation_type_code_required");

        if (trimmed.Length > RelationTypeCodeMaxLength)
        {
            throw new DomainException(
                "release_import_relation_suggestion.relation_type_code_too_long",
                $"Release import relation suggestion relation type code must be at most {RelationTypeCodeMaxLength} characters");
        }

        foreach (char character in trimmed)
        {
            bool isLetterOrDigit = character is (>= 'A' and <= 'Z') or (>= 'a' and <= 'z') or (>= '0' and <= '9');
            if (!isLetterOrDigit && character is not '_' and not '-')
            {
                throw new DomainException(
                    "release_import_relation_suggestion.relation_type_code_invalid",
                    "Release import relation suggestion relation type code is invalid");
            }
        }

        return trimmed;
    }

    private static string SerializePayload(ReleaseImportRelationSuggestionPayload payload)
    {
        string json = ImportJson.SerializeValue(payload);
        return json.Length > JsonPayloadMaxLength
            ? throw new DomainException(
                "release_import_relation_suggestion.payload_too_large",
                $"Release import relation suggestion payload JSON must be at most {JsonPayloadMaxLength} characters")
            : json;
    }

    private static int ValidateConfidence(int confidence)
    {
        return confidence is < 0 or > 100
            ? throw new DomainException(
                "release_import_relation_suggestion.confidence_invalid",
                "Release import relation suggestion confidence must be between 0 and 100")
            : confidence;
    }
}
