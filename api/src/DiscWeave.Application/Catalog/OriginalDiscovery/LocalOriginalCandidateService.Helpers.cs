using DiscWeave.Application.Catalog.TrackStacks;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed partial class LocalOriginalCandidateService
{
    private static HashSet<OriginalCandidateHardGate> HardGates(
        LocalOriginalCandidateSnapshot snapshot,
        TrackStackGraph graph,
        CollectionId collectionId,
        LocalOriginalCandidateSnapshot.SourceTrackFact source,
        string? directedRelationTypeCode,
        LocalOriginalCandidateSnapshot.CandidateTrackFact candidate)
    {
        HashSet<OriginalCandidateHardGate> gates = [];
        if (candidate.CollectionId != collectionId)
        {
            _ = gates.Add(OriginalCandidateHardGate.ForeignCollection);
        }

        if (candidate.TrackId == source.TrackId)
        {
            _ = gates.Add(OriginalCandidateHardGate.Self);
        }

        LocalOriginalCandidateSnapshot.StackTrackFact? stackTrack =
            snapshot.StackTracks.SingleOrDefault(track =>
                track.CollectionId == collectionId
                && track.TrackId == candidate.TrackId);
        if (stackTrack is null)
        {
            _ = gates.Add(OriginalCandidateHardGate.IncompatibleStack);
        }
        else
        {
            if (graph.IsMember(candidate.TrackId)
                || (!graph.IsStandalone(candidate.TrackId)
                    && !IsExistingRoot(
                        snapshot,
                        graph,
                        collectionId,
                        candidate)))
            {
                _ = gates.Add(OriginalCandidateHardGate.IncompatibleStack);
            }

            if (graph.Project(CreateTrack(stackTrack)).CyclePaths.Count > 0)
            {
                _ = gates.Add(OriginalCandidateHardGate.Cycle);
            }
        }

        if (HasRelation(
            snapshot,
            collectionId,
            source.TrackId,
            candidate.TrackId,
            CoverRelationTypeCode,
            eitherDirection: true))
        {
            _ = gates.Add(OriginalCandidateHardGate.ExplicitCover);
        }

        if (snapshot.StackRelations.Any(relation =>
            relation.CollectionId == collectionId
            && relation.SourceTrackId == candidate.TrackId
            && relation.TargetTrackId == source.TrackId
            && directedRelationTypeCode is not null
            && string.Equals(
                relation.RelationTypeCode,
                directedRelationTypeCode,
                StringComparison.Ordinal)))
        {
            _ = gates.Add(OriginalCandidateHardGate.ReversedDirectedLineage);
        }

        return gates;
    }

    private static TrackStackGraph CreateGraph(
        LocalOriginalCandidateSnapshot snapshot,
        CollectionId collectionId)
    {
        var enabled =
            snapshot.EnabledStackRelationTypeCodes.ToHashSet(
                StringComparer.Ordinal);
        Track[] tracks =
        [
            .. snapshot.StackTracks
                .Where(track => track.CollectionId == collectionId)
                .GroupBy(track => track.TrackId)
                .Select(group => CreateTrack(group.First()))
        ];
        TrackRelation[] relations =
        [
            .. snapshot.StackRelations
                .Where(relation =>
                    relation.CollectionId == collectionId
                    && enabled.Contains(relation.RelationTypeCode))
                .Select(relation => TrackRelation.Create(
                    TrackRelationId.New(),
                    collectionId,
                    relation.SourceTrackId,
                    relation.TargetTrackId,
                    relation.RelationTypeCode))
        ];
        return new TrackStackGraph(tracks, relations);
    }

    private static Track CreateTrack(
        LocalOriginalCandidateSnapshot.StackTrackFact fact)
    {
        var track = Track.Create(fact.CollectionId, fact.TrackId, fact.Title);
        if (fact.IsOriginal)
        {
            track.UpdateMetadata(track.Metadata.WithOriginalMarker(true));
        }

        return track;
    }

    private static bool IsExistingRoot(
        LocalOriginalCandidateSnapshot snapshot,
        TrackStackGraph graph,
        CollectionId collectionId,
        LocalOriginalCandidateSnapshot.CandidateTrackFact candidate)
    {
        return candidate.CollectionId == collectionId
            && candidate.IsOriginal
            && snapshot.StackTracks.Any(track =>
                track.CollectionId == collectionId
                && track.TrackId == candidate.TrackId)
            && graph.HasMembers(candidate.TrackId)
            && !graph.IsMember(candidate.TrackId);
    }

    private static int MemberCount(
        LocalOriginalCandidateSnapshot snapshot,
        TrackStackGraph graph,
        CollectionId collectionId,
        TrackId trackId)
    {
        Track root = CreateTrack(snapshot.StackTracks.Single(track =>
            track.CollectionId == collectionId && track.TrackId == trackId));
        return graph.Project(root).Members.Count;
    }

    private static MarkerFacts FindMarker(
        LocalOriginalCandidateSnapshot snapshot,
        CollectionId collectionId,
        string title)
    {
        OriginalVersionMarkerMatcher.TitleToken? token =
            OriginalVersionMarkerMatcher.TrySplitLastParenthetical(title);
        if (token is null)
        {
            return MarkerFacts.None(title);
        }

        TrackRelationParserRule[] rules =
        [
            .. snapshot.ParserRules
                .Where(rule =>
                    rule.Direction
                        == TrackRelationParserRuleDirection.VariantToBase)
                .Select(rule =>
                TrackRelationParserRule.Create(
                    collectionId,
                    rule.RuleId,
                    rule.RelationTypeCode,
                    rule.Alias,
                    new TrackRelationParserRuleSettings
                    {
                        MatchMode = rule.MatchMode,
                        Confidence = rule.Confidence,
                        Direction = rule.Direction,
                        SortOrder = rule.SortOrder
                    },
                    new TrackRelationParserRuleState
                    {
                        IsActive = rule.IsActive,
                        IsBuiltin = false
                    }))
        ];
        TrackRelationParserRule? matched =
            OriginalVersionMarkerMatcher.MatchRule(token.Token, rules);
        if (matched is null)
        {
            return MarkerFacts.None(title);
        }

        string? suggested = snapshot.EnabledStackRelationTypeCodes.Contains(
            matched.RelationTypeCode,
            StringComparer.Ordinal)
            ? matched.RelationTypeCode
            : null;
        return new MarkerFacts
        {
            BaseTitle = token.BaseTitle,
            HasMarker = true,
            RelationTypeCode = matched.RelationTypeCode,
            SuggestedRelationTypeCode = suggested
        };
    }

    private static OriginalCandidateChronology? FindChronology(
        LocalOriginalCandidateSnapshot snapshot,
        CollectionId collectionId,
        TrackId trackId)
    {
        return snapshot.Appearances
            .Where(appearance =>
                appearance.CollectionId == collectionId
                && appearance.TrackId == trackId)
            .Select(ToChronology)
            .Where(chronology => chronology is not null)
            .OrderBy(chronology => chronology!.LowerBound)
            .ThenBy(chronology => chronology!.UpperBound)
            .FirstOrDefault();
    }

    private static OriginalCandidateChronology? ToChronology(
        LocalOriginalCandidateSnapshot.AppearanceFact appearance)
    {
        return appearance.ReleaseDate is { } releaseDate
            ? OriginalCandidateChronology.FromDay(releaseDate, true)
            : appearance.ReleaseYear is { } releaseYear
                ? OriginalCandidateChronology.FromYear(releaseYear, true)
                : null;
    }

    private static IReadOnlyList<string> ArtistNames(
        LocalOriginalCandidateSnapshot snapshot,
        CollectionId collectionId,
        TrackId trackId)
    {
        return
        [
            .. snapshot.PrimaryArtists
                .Where(artist =>
                    artist.CollectionId == collectionId
                    && artist.TrackId == trackId)
                .Select(artist => artist.DisplayName.Trim())
                .Where(name => name.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(name => name, StringComparer.OrdinalIgnoreCase)
                .ThenBy(name => name, StringComparer.Ordinal)
        ];
    }

    private static string ArtistDisplay(
        LocalOriginalCandidateSnapshot snapshot,
        CollectionId collectionId,
        TrackId trackId)
    {
        return string.Join(", ", ArtistNames(snapshot, collectionId, trackId));
    }

    private static bool CreditsSupport(
        LocalOriginalCandidateSnapshot snapshot,
        CollectionId collectionId,
        TrackId sourceTrackId,
        string? relationTypeCode)
    {
        return string.Equals(
                relationTypeCode,
                RemixRelationTypeCode,
                StringComparison.Ordinal)
            && snapshot.Credits.Any(credit =>
                credit.CollectionId == collectionId
                && credit.TrackId == sourceTrackId
                && string.Equals(
                    credit.RoleCode,
                    RemixerRoleCode,
                    StringComparison.Ordinal));
    }
}
