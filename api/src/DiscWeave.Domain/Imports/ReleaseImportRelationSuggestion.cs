using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Interfaces;
using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Imports;

public sealed class ReleaseImportRelationSuggestion : IEntity<ReleaseImportRelationSuggestionId>
{
    private string _reviewedPayloadJson = "{}";
#pragma warning disable IDE0044 // EF writes this mapped backing field during materialization.
    private string _suggestedPayloadJson = "{}";
#pragma warning restore IDE0044

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
        Token = Guard.RequiredText(token, nameof(token), "release_import_relation_suggestion.token_required");
        Confidence = ValidateConfidence(confidence);
        Decision = ReleaseImportRelationSuggestionDecision.Pending;
        _suggestedPayloadJson = ImportJson.SerializeValue(suggestedPayload);
        _reviewedPayloadJson = _suggestedPayloadJson;
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
        _reviewedPayloadJson = ImportJson.SerializeValue(reviewedPayload);
        Decision = ReleaseImportRelationSuggestionDecision.Accepted;
    }

    public void Reject()
    {
        Decision = ReleaseImportRelationSuggestionDecision.Rejected;
    }

    public void Reset()
    {
        _reviewedPayloadJson = _suggestedPayloadJson;
        Decision = ReleaseImportRelationSuggestionDecision.Pending;
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
