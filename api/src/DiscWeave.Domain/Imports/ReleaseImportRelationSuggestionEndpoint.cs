using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Imports;

public sealed record ReleaseImportRelationSuggestionEndpoint(
    ReleaseImportRelationSuggestionEndpointKind Kind,
    Guid TrackId)
{
    public static ReleaseImportRelationSuggestionEndpoint ForDraftTrack(ReleaseImportDraftTrackId trackId)
    {
        return new ReleaseImportRelationSuggestionEndpoint(ReleaseImportRelationSuggestionEndpointKind.DraftTrack, trackId.Value);
    }

    public static ReleaseImportRelationSuggestionEndpoint ForExistingTrack(TrackId trackId)
    {
        return new ReleaseImportRelationSuggestionEndpoint(ReleaseImportRelationSuggestionEndpointKind.ExistingTrack, trackId.Value);
    }
}
