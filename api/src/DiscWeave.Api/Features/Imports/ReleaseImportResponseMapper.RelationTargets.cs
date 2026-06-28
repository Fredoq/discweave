using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;

namespace DiscWeave.Api.Features.Imports;

internal static partial class ReleaseImportResponseMapper
{
    private sealed class RelationTargetLookup
    {
        private readonly Dictionary<Guid, ReleaseImportDraftTrack> _draftTracksById;
        private readonly Dictionary<string, ReleaseImportDraftTrack[]> _draftTracksByNormalizedTitle;
        private readonly Dictionary<string, ReleaseImportDraftTrack[]> _draftTracksByConservativeTitle;
        private readonly Dictionary<string, Track[]> _existingTracksByNormalizedTitle;
        private readonly Dictionary<string, Track[]> _existingTracksByConservativeTitle;

        private RelationTargetLookup(
            Dictionary<Guid, ReleaseImportDraftTrack> draftTracksById,
            Dictionary<string, ReleaseImportDraftTrack[]> draftTracksByNormalizedTitle,
            Dictionary<string, ReleaseImportDraftTrack[]> draftTracksByConservativeTitle,
            Dictionary<string, Track[]> existingTracksByNormalizedTitle,
            Dictionary<string, Track[]> existingTracksByConservativeTitle)
        {
            _draftTracksById = draftTracksById;
            _draftTracksByNormalizedTitle = draftTracksByNormalizedTitle;
            _draftTracksByConservativeTitle = draftTracksByConservativeTitle;
            _existingTracksByNormalizedTitle = existingTracksByNormalizedTitle;
            _existingTracksByConservativeTitle = existingTracksByConservativeTitle;
        }

        public static RelationTargetLookup Create(IReadOnlyList<ReleaseImportDraftTrack> draftTracks, IReadOnlyList<Track> existingTracks)
        {
            return new RelationTargetLookup(
                draftTracks.ToDictionary(track => track.Id.Value),
                draftTracks
                    .Where(IsCatalogTrackCandidate)
                    .GroupBy(track => RelationSuggestionAnalyzer.NormalizeTitle(track.Title), StringComparer.Ordinal)
                    .ToDictionary(group => group.Key, group => group.ToArray(), StringComparer.Ordinal),
                draftTracks
                    .Where(IsCatalogTrackCandidate)
                    .GroupBy(track => RelationSuggestionAnalyzer.NormalizeTitleConservative(track.Title), StringComparer.Ordinal)
                    .ToDictionary(group => group.Key, group => group.ToArray(), StringComparer.Ordinal),
                existingTracks
                    .GroupBy(track => RelationSuggestionAnalyzer.NormalizeTitle(track.Title), StringComparer.Ordinal)
                    .ToDictionary(group => group.Key, group => group.ToArray(), StringComparer.Ordinal),
                existingTracks
                    .GroupBy(track => RelationSuggestionAnalyzer.NormalizeTitleConservative(track.Title), StringComparer.Ordinal)
                    .ToDictionary(group => group.Key, group => group.ToArray(), StringComparer.Ordinal));
        }

        public IReadOnlyList<ReleaseImportRelationSuggestionEndpointResponse> ForSuggestion(ReleaseImportRelationSuggestionPayload payload)
        {
            if (!TryTokenTrack(payload.Source, out ReleaseImportDraftTrack? tokenTrack, out RelationSuggestionAnalyzer.TitleToken? titleToken) &&
                !TryTokenTrack(payload.Target, out tokenTrack, out titleToken))
            {
                return [];
            }

            string normalizedBaseTitle = RelationSuggestionAnalyzer.NormalizeTitle(titleToken.BaseTitle);
            IReadOnlyList<ReleaseImportRelationSuggestionEndpointResponse> exactTargets = BuildTargetOptions(
                tokenTrack,
                normalizedBaseTitle,
                _draftTracksByNormalizedTitle.GetValueOrDefault(normalizedBaseTitle) ?? [],
                _existingTracksByNormalizedTitle.GetValueOrDefault(normalizedBaseTitle) ?? [],
                RelationSuggestionAnalyzer.NormalizeTitle);
            if (exactTargets.Count > 0)
            {
                return exactTargets;
            }

            string conservativeBaseTitle = RelationSuggestionAnalyzer.NormalizeTitleConservative(titleToken.BaseTitle);
            return BuildTargetOptions(
                tokenTrack,
                conservativeBaseTitle,
                _draftTracksByConservativeTitle.GetValueOrDefault(conservativeBaseTitle) ?? [],
                _existingTracksByConservativeTitle.GetValueOrDefault(conservativeBaseTitle) ?? [],
                RelationSuggestionAnalyzer.NormalizeTitleConservative);
        }

        private static IReadOnlyList<ReleaseImportRelationSuggestionEndpointResponse> BuildTargetOptions(
            ReleaseImportDraftTrack tokenTrack,
            string normalizedBaseTitle,
            IReadOnlyList<ReleaseImportDraftTrack> draftTargets,
            IReadOnlyList<Track> existingTargets,
            Func<string, string> normalize)
        {
            return
            [
                .. draftTargets
                    .Where(track => track.Id != tokenTrack.Id &&
                        track.DraftId == tokenTrack.DraftId &&
                        normalize(track.Title) == normalizedBaseTitle)
                    .Select(track => new ReleaseImportRelationSuggestionEndpointResponse("draftTrack", track.Id.Value)),
                .. existingTargets
                    .Where(track => normalize(track.Title) == normalizedBaseTitle)
                    .Select(track => new ReleaseImportRelationSuggestionEndpointResponse("existingTrack", track.Id.Value))
            ];
        }

        private bool TryTokenTrack(
            ReleaseImportRelationSuggestionEndpoint? endpoint,
            out ReleaseImportDraftTrack tokenTrack,
            out RelationSuggestionAnalyzer.TitleToken titleToken)
        {
            if (endpoint?.Kind == ReleaseImportRelationSuggestionEndpointKind.DraftTrack &&
                _draftTracksById.TryGetValue(endpoint.TrackId, out ReleaseImportDraftTrack? draftTrack) &&
                IsCatalogTrackCandidate(draftTrack) &&
                RelationSuggestionAnalyzer.TrySplitLastParenthetical(draftTrack.Title) is { } token)
            {
                tokenTrack = draftTrack;
                titleToken = token;
                return true;
            }

            tokenTrack = null!;
            titleToken = null!;
            return false;
        }

        private static bool IsCatalogTrackCandidate(ReleaseImportDraftTrack track)
        {
            return !track.IsSkipped && track.TrackMode != ReleaseImportTrackMode.ReleaseOnly;
        }
    }
}
