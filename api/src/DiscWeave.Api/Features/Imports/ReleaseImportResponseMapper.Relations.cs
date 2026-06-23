using DiscWeave.Domain.Imports;

namespace DiscWeave.Api.Features.Imports;

internal static partial class ReleaseImportResponseMapper
{
    private static ReleaseImportRelationSuggestionResponse ToRelationSuggestionResponse(
        ReleaseImportRelationSuggestion suggestion,
        RelationTargetLookup targetLookup)
    {
        ReleaseImportRelationSuggestionPayload suggestedPayload = suggestion.SuggestedPayload;
        ReleaseImportRelationSuggestionPayload reviewedPayload = suggestion.ReviewedPayload;

        return new ReleaseImportRelationSuggestionResponse(
            suggestion.Id.Value,
            suggestion.DraftId.Value,
            suggestion.Token,
            suggestion.Confidence,
            DecisionCode(suggestion.Decision),
            ToRelationSuggestionPayloadResponse(suggestedPayload),
            ToRelationSuggestionPayloadResponse(reviewedPayload),
            targetLookup.ForSuggestion(suggestedPayload),
            !RelationPayloadEquals(suggestedPayload, reviewedPayload));
    }

    private static ReleaseImportRelationSuggestionPayloadResponse ToRelationSuggestionPayloadResponse(
        ReleaseImportRelationSuggestionPayload payload)
    {
        return new ReleaseImportRelationSuggestionPayloadResponse(
            ToRelationSuggestionEndpointResponse(payload.Source),
            payload.Target is null ? null : ToRelationSuggestionEndpointResponse(payload.Target),
            payload.RelationTypeCode ?? string.Empty);
    }

    private static ReleaseImportRelationSuggestionEndpointResponse ToRelationSuggestionEndpointResponse(
        ReleaseImportRelationSuggestionEndpoint endpoint)
    {
        return new ReleaseImportRelationSuggestionEndpointResponse(
            EndpointKindCode(endpoint.Kind),
            endpoint.TrackId);
    }

    private static bool RelationPayloadEquals(
        ReleaseImportRelationSuggestionPayload left,
        ReleaseImportRelationSuggestionPayload right)
    {
        return left.Source == right.Source &&
            left.Target == right.Target &&
            string.Equals(left.RelationTypeCode, right.RelationTypeCode, StringComparison.Ordinal);
    }
}
