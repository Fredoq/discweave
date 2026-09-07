using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.Catalog.TrackStacks;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Features.Tracks;

public static partial class TracksEndpointRouteBuilderExtensions
{
    private const string UnknownArtistDisplay = "Unknown artist";

    private static StackTargetMatch? MatchStackTarget(
        TrackStackProjection stack,
        IReadOnlyDictionary<TrackId, string> artistDisplays,
        string search)
    {
        string rootArtist = artistDisplays.GetValueOrDefault(stack.Original.Id, UnknownArtistDisplay);
        int? rootRank = null;
        if (stack.Original.Title.Contains(
            search,
            StringComparison.OrdinalIgnoreCase))
        {
            rootRank = 0;
        }
        else if (rootArtist.Contains(
            search,
            StringComparison.OrdinalIgnoreCase))
        {
            rootRank = 1;
        }
        TrackStackMemberProjection? matchedMember = rootRank.HasValue
            ? null
            : stack.Members
                .Where(member =>
                    member.Track.Title.Contains(
                        search,
                        StringComparison.OrdinalIgnoreCase) ||
                    artistDisplays.GetValueOrDefault(
                        member.Track.Id,
                        UnknownArtistDisplay).Contains(
                            search,
                            StringComparison.OrdinalIgnoreCase))
                .OrderBy(
                    member => member.Track.Title,
                    StringComparer.OrdinalIgnoreCase)
                .ThenBy(member => member.Track.Id.Value)
                .FirstOrDefault();
        return !rootRank.HasValue && matchedMember is null
            ? null
            : CreateStackTargetMatch(stack, artistDisplays, matchedMember, rootRank ?? 2);
    }

    private static StackTargetMatch? SuggestStackTarget(
        TrackStackProjection stack,
        IReadOnlyDictionary<TrackId, string> artistDisplays,
        string sourceTitleKey,
        string? sourceArtistKey,
        IReadOnlyList<TrackRelationParserRule> parserRules)
    {
        bool rootMatches = SuggestionTitleKey(stack.Original.Title, parserRules) == sourceTitleKey;
        TrackStackMemberProjection? matchedMember = rootMatches
            ? null
            : stack.Members
                .Where(member => SuggestionTitleKey(member.Track.Title, parserRules) == sourceTitleKey)
                .OrderBy(member => member.Track.Title, StringComparer.OrdinalIgnoreCase)
                .ThenBy(member => member.Track.Id.Value)
                .FirstOrDefault();
        if (!rootMatches && matchedMember is null)
        {
            return null;
        }

        TrackId matchedTrackId = matchedMember?.Track.Id ?? stack.Original.Id;
        bool sameArtist = sourceArtistKey is not null
            && artistDisplays.TryGetValue(matchedTrackId, out string? matchedArtist)
            && OriginalDiscoveryTextNormalizer.ForArtistKey(matchedArtist) == sourceArtistKey;
        int rank = (rootMatches ? 0 : 2) + (sameArtist ? 0 : 1);
        return CreateStackTargetMatch(stack, artistDisplays, matchedMember, rank);
    }

    private static StackTargetMatch CreateStackTargetMatch(
        TrackStackProjection stack,
        IReadOnlyDictionary<TrackId, string> artistDisplays,
        TrackStackMemberProjection? matchedMember,
        int rank)
    {
        TrackStackTargetMatchedMemberResponse? memberResponse = matchedMember is null
            ? null
            : new TrackStackTargetMatchedMemberResponse(
                matchedMember.Track.Id.Value,
                matchedMember.Track.Title,
                artistDisplays.GetValueOrDefault(matchedMember.Track.Id, UnknownArtistDisplay));
        var response = new TrackStackTargetResponse(
            stack.Original.Id.Value,
            stack.Original.Title,
            artistDisplays.GetValueOrDefault(stack.Original.Id, UnknownArtistDisplay),
            VersionYear(stack.Original),
            stack.Members.Count,
            memberResponse);
        return new StackTargetMatch
        {
            Rank = rank,
            Response = response
        };
    }

    private static string SuggestionTitleKey(
        string title,
        IReadOnlyList<TrackRelationParserRule> parserRules)
    {
        OriginalVersionMarkerMatcher.TitleToken? token =
            OriginalVersionMarkerMatcher.TrySplitLastParenthetical(title);
        string baseTitle = token is not null
            && OriginalVersionMarkerMatcher.MatchRule(token.Token, parserRules) is not null
                ? token.BaseTitle
                : title.Trim();
        return OriginalDiscoveryTextNormalizer.ForTitleKey(baseTitle);
    }

    private sealed class StackTargetMatch
    {
        public required int Rank { get; init; }
        public required TrackStackTargetResponse Response { get; init; }
    }
}
