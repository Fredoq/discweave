using DiscWeave.Api.Features.Tracks;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Imports;

internal static partial class ReleaseImportResponseMapper
{
    private static async Task<IReadOnlyList<ReleaseImportRelationSuggestionResponse>> EnrichRelationIdentitiesAsync(
        IReadOnlyList<ReleaseImportRelationSuggestionResponse> suggestions,
        IReadOnlyList<ReleaseImportDraft> drafts,
        IReadOnlyList<ReleaseImportDraftTrack> draftTracks,
        IReadOnlyList<Track> existingTracks,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        if (suggestions.Count == 0)
        {
            return suggestions;
        }

        ReleaseImportRelationSuggestionEndpointResponse[] endpoints =
        [
            .. suggestions.SelectMany(suggestion => suggestion.TargetOptions.Concat(
                new[] { suggestion.Suggested.Source, suggestion.Suggested.Target,
                    suggestion.Reviewed.Source, suggestion.Reviewed.Target }
                    .OfType<ReleaseImportRelationSuggestionEndpointResponse>()))
                .DistinctBy(endpoint => (endpoint.Kind, endpoint.Id))
        ];
        var existingById = existingTracks.ToDictionary(track => track.Id.Value);
        TrackId[] existingIds = [.. endpoints
            .Where(endpoint => endpoint.Kind == "existingTrack" && existingById.ContainsKey(endpoint.Id))
            .Select(endpoint => new TrackId(endpoint.Id))];
        IReadOnlyDictionary<TrackId, string> artists = await TracksEndpointRouteBuilderExtensions.LoadTrackArtistDisplaysAsync(
            existingIds, context, collectionId, cancellationToken);
        var draftTracksById = draftTracks.ToDictionary(track => track.Id.Value);
        var draftsById = drafts.ToDictionary(draft => draft.Id);
        Dictionary<(string Kind, Guid Id), ReleaseImportRelationSuggestionEndpointResponse> identities =
            endpoints.ToDictionary(endpoint => (endpoint.Kind, endpoint.Id), EnrichEndpoint);

        return [.. suggestions.Select(suggestion => suggestion with
        {
            Suggested = EnrichPayload(suggestion.Suggested),
            Reviewed = EnrichPayload(suggestion.Reviewed),
            TargetOptions = [.. suggestion.TargetOptions.Select(endpoint => identities[(endpoint.Kind, endpoint.Id)])]
        })];

        ReleaseImportRelationSuggestionPayloadResponse EnrichPayload(ReleaseImportRelationSuggestionPayloadResponse payload)
        {
            return payload with
            {
                Source = identities[(payload.Source.Kind, payload.Source.Id)],
                Target = payload.Target is null ? null : identities[(payload.Target.Kind, payload.Target.Id)]
            };
        }

        ReleaseImportRelationSuggestionEndpointResponse EnrichEndpoint(ReleaseImportRelationSuggestionEndpointResponse endpoint)
        {
            return endpoint.Kind switch
            {
                "existingTrack" when existingById.TryGetValue(endpoint.Id, out Track? track) => endpoint with
                {
                    Title = track.Title,
                    ArtistDisplay = artists.GetValueOrDefault(track.Id),
                    VersionYear = OptionalStruct(track.Metadata.VersionYear)
                },
                "draftTrack" when draftTracksById.TryGetValue(endpoint.Id, out ReleaseImportDraftTrack? draftTrack) => endpoint with
                {
                    Title = draftTrack.Title,
                    ArtistDisplay = RelationDraftArtistDisplay(draftTrack, draftsById[draftTrack.DraftId]),
                    VersionYear = draftTrack.VersionYear
                },
                _ => endpoint
            };
        }
    }

    private static string? RelationDraftArtistDisplay(ReleaseImportDraftTrack track, ReleaseImportDraft draft)
    {
        IEnumerable<ReleaseImportArtistCredit> credits = EffectiveTrackArtistCredits(track);
        if (track.InheritReleaseArtistCredits && !draft.IsVariousArtists)
        {
            IReadOnlyList<ReleaseImportArtistCredit> releaseCredits = EffectiveArtistCredits(draft);
            ReleaseImportArtistCredit[] mainCredits = [.. releaseCredits.Where(IsMainArtist)];
            credits = credits.Concat(mainCredits.Length > 0 ? mainCredits : releaseCredits);
        }

        ReleaseImportArtistCredit[] namedCredits = [.. credits.Where(credit => !string.IsNullOrWhiteSpace(credit.Name))];
        ReleaseImportArtistCredit[] mainArtists = [.. namedCredits.Where(IsMainArtist)];
        string[] names = [.. (mainArtists.Length > 0 ? mainArtists : namedCredits)
            .Select(credit => credit.Name).Distinct(StringComparer.OrdinalIgnoreCase)];
        return names.Length > 0 ? string.Join(", ", names) : null;

        static bool IsMainArtist(ReleaseImportArtistCredit credit)
        {
            return credit.Role == "mainArtist" || string.Equals(credit.Role, "Main artist", StringComparison.OrdinalIgnoreCase);
        }
    }
}
