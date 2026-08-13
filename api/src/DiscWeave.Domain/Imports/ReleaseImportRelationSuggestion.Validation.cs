using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Imports;

public sealed partial class ReleaseImportRelationSuggestion
{
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
            "source");
        ReleaseImportRelationSuggestionEndpoint? target = payload.Target is null
            ? null
            : ValidateEndpoint(payload.Target, nameof(payload.Target), "target");

        return new ReleaseImportRelationSuggestionPayload(
            source,
            target,
            ValidateRelationTypeCode(payload.RelationTypeCode));
    }

    private static ReleaseImportRelationSuggestionEndpoint ValidateEndpoint(
        ReleaseImportRelationSuggestionEndpoint? endpoint,
        string fieldName,
        string codePrefix)
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
        Guid trackId = endpoint.TrackId == Guid.Empty
            ? throw new DomainException(
                $"release_import_relation_suggestion.{codePrefix}_track_required",
                $"{fieldName} track id is required")
            : endpoint.TrackId;

        return kind == ReleaseImportRelationSuggestionEndpointKind.DraftTrack
            ? ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(new ReleaseImportDraftTrackId(trackId))
            : ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(new TrackId(trackId));
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
        return TrackRelationTypeCode.Required(
            relationTypeCode ?? string.Empty,
            nameof(relationTypeCode),
            "release_import_relation_suggestion.relation_type_code_required",
            "release_import_relation_suggestion.relation_type_code_invalid");
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
