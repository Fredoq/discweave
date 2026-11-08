using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Imports;

public sealed partial class ReleaseImportRelationSuggestion
{
    public bool RetargetMergedTrackReferences(IReadOnlySet<TrackId> duplicateIds, TrackId keeperId)
    {
        ReleaseImportRelationSuggestionPayload suggested = Retarget(SuggestedPayload);
        ReleaseImportRelationSuggestionPayload reviewed = Retarget(ReviewedPayload);
        if (suggested == SuggestedPayload && reviewed == ReviewedPayload)
        {
            return false;
        }

        // Both JSON payloads and their indexed foreign keys must move together.
        SetSuggestedPayload(suggested);
        SetReviewedPayload(reviewed);
        return true;

        ReleaseImportRelationSuggestionPayload Retarget(ReleaseImportRelationSuggestionPayload payload)
        {
            return payload with
            {
                Source = RetargetEndpoint(payload.Source),
                Target = payload.Target is null ? null : RetargetEndpoint(payload.Target)
            };
        }

        ReleaseImportRelationSuggestionEndpoint RetargetEndpoint(ReleaseImportRelationSuggestionEndpoint endpoint)
        {
            return endpoint.Kind == ReleaseImportRelationSuggestionEndpointKind.ExistingTrack &&
                duplicateIds.Contains(new TrackId(endpoint.TrackId))
                ? ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(keeperId)
                : endpoint;
        }
    }
}
