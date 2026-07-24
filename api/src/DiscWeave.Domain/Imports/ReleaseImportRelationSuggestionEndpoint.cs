using DiscWeave.Domain.SharedKernel.Ids;
using System.Text.Json.Serialization;

namespace DiscWeave.Domain.Imports;

public sealed record ReleaseImportRelationSuggestionEndpoint
{
    [JsonConstructor]
    private ReleaseImportRelationSuggestionEndpoint(
        ReleaseImportRelationSuggestionEndpointKind kind,
        Guid trackId)
    {
        Kind = kind;
        TrackId = trackId;
    }

    public ReleaseImportRelationSuggestionEndpointKind Kind { get; }
    public Guid TrackId { get; }

    public static ReleaseImportRelationSuggestionEndpoint ForDraftTrack(ReleaseImportDraftTrackId trackId)
    {
        return new ReleaseImportRelationSuggestionEndpoint(ReleaseImportRelationSuggestionEndpointKind.DraftTrack, trackId.Value);
    }

    public static ReleaseImportRelationSuggestionEndpoint ForExistingTrack(TrackId trackId)
    {
        return new ReleaseImportRelationSuggestionEndpoint(ReleaseImportRelationSuggestionEndpointKind.ExistingTrack, trackId.Value);
    }
}
