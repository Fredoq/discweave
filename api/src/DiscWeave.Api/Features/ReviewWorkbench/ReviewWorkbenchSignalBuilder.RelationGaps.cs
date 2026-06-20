using DiscWeave.Api.Features.Imports;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.ReviewWorkbench;

public static partial class ReviewWorkbenchSignalBuilder
{
    private static async Task<IEnumerable<ReviewWorkbenchSignal>> RelationGapSignalsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyList<Track> tracks,
        CancellationToken cancellationToken)
    {
        string[] activeRelationTypeCodes = await context.CollectionDictionaryEntries.AsNoTracking()
            .Where(entry =>
                entry.CollectionId == collectionId &&
                entry.Kind == DictionaryKind.TrackRelationType &&
                entry.IsActive)
            .Select(entry => entry.Code)
            .ToArrayAsync(cancellationToken);
        HashSet<string> activeRelationTypes = [.. activeRelationTypeCodes];
        if (activeRelationTypes.Count == 0)
        {
            return [];
        }

        TrackRelationParserRule[] rules = await context.TrackRelationParserRules.AsNoTracking()
            .Where(rule =>
                rule.CollectionId == collectionId &&
                rule.IsActive &&
                rule.MatchMode == TrackRelationParserRuleMatchMode.ExactLastParentheticalToken &&
                activeRelationTypes.Contains(rule.RelationTypeCode))
            .ToArrayAsync(cancellationToken);
        if (rules.Length == 0)
        {
            return [];
        }

        HashSet<TrackRelationIdentity> existingRelations =
        [
            .. (await context.TrackRelations.AsNoTracking()
                .Where(relation => relation.CollectionId == collectionId)
                .ToArrayAsync(cancellationToken))
                .Select(relation => new TrackRelationIdentity(
                    relation.SourceTrackId,
                    relation.TargetTrackId,
                    relation.RelationType))
        ];
        var tracksByNormalizedTitle = tracks
            .GroupBy(track => RelationSuggestionAnalyzer.NormalizeTitle(track.Title), StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.ToArray(), StringComparer.Ordinal);
        var tracksByConservativeTitle = tracks
            .GroupBy(track => RelationSuggestionAnalyzer.NormalizeTitleConservative(track.Title), StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.ToArray(), StringComparer.Ordinal);
        var signals = new List<ReviewWorkbenchSignal>();

        foreach (Track track in tracks)
        {
            RelationSuggestionAnalyzer.TitleToken? titleToken = RelationSuggestionAnalyzer.TrySplitLastParenthetical(track.Title);
            if (titleToken is null)
            {
                continue;
            }

            TrackRelationParserRule? rule = RelationSuggestionAnalyzer.MatchRule(titleToken.Token, rules);
            if (rule is null)
            {
                continue;
            }

            Track[] candidateTargets = FindRelationGapTargets(
                track,
                titleToken.BaseTitle,
                tracksByNormalizedTitle,
                tracksByConservativeTitle);
            Track[] missingRelationTargets =
            [
                .. candidateTargets.Where(target => !HasExpectedRelation(track.Id, target.Id, rule, existingRelations))
            ];
            if (missingRelationTargets.Length == 0)
            {
                continue;
            }

            ReviewWorkbenchSignalTarget[] targets =
            [
                Target(ReviewWorkbenchTargetKinds.Track, track.Id.Value, track.Title, $"Variant token: {titleToken.Token}"),
                .. missingRelationTargets
                    .OrderBy(target => target.Title, StringComparer.OrdinalIgnoreCase)
                    .ThenBy(target => target.Id.Value)
                    .Select(target => Target(ReviewWorkbenchTargetKinds.Track, target.Id.Value, target.Title, "Possible base title"))
            ];
            string comparisonKey = string.Join(
                "|",
                rule.RelationTypeCode,
                rule.Direction.ToString(),
                RelationSuggestionAnalyzer.NormalizeTitleConservative(titleToken.BaseTitle),
                RelationSuggestionAnalyzer.NormalizeTitle(titleToken.Token));
            signals.Add(CreateSignal(
                collectionId,
                ReviewWorkbenchCategories.RelationGaps,
                ReviewWorkbenchSubtypes.VariantTitleWithoutRelation,
                $"Variant title without track relation: {track.Title}",
                targets,
                comparisonKey,
                ReviewWorkbenchSourceDetectors.TrackRelationRules));
        }

        return signals;
    }

    private static Track[] FindRelationGapTargets(
        Track source,
        string baseTitle,
        IReadOnlyDictionary<string, Track[]> tracksByNormalizedTitle,
        IReadOnlyDictionary<string, Track[]> tracksByConservativeTitle)
    {
        string normalizedBaseTitle = RelationSuggestionAnalyzer.NormalizeTitle(baseTitle);
        Track[] exactTargets =
        [
            .. (tracksByNormalizedTitle.GetValueOrDefault(normalizedBaseTitle) ?? [])
                .Where(track => track.Id != source.Id)
        ];
        if (exactTargets.Length > 0)
        {
            return exactTargets;
        }

        string conservativeBaseTitle = RelationSuggestionAnalyzer.NormalizeTitleConservative(baseTitle);
        return
        [
            .. (tracksByConservativeTitle.GetValueOrDefault(conservativeBaseTitle) ?? [])
                .Where(track => track.Id != source.Id)
        ];
    }

    private static bool HasExpectedRelation(
        TrackId variantTrackId,
        TrackId baseTrackId,
        TrackRelationParserRule rule,
        HashSet<TrackRelationIdentity> existingRelations)
    {
        TrackRelationIdentity expected = rule.Direction switch
        {
            TrackRelationParserRuleDirection.VariantToBase => new TrackRelationIdentity(
                variantTrackId,
                baseTrackId,
                rule.RelationTypeCode),
            TrackRelationParserRuleDirection.BaseToVariant => new TrackRelationIdentity(
                baseTrackId,
                variantTrackId,
                rule.RelationTypeCode),
            _ => throw new InvalidOperationException("Track relation parser rule direction is not supported")
        };

        return existingRelations.Contains(expected);
    }

    private readonly record struct TrackRelationIdentity(
        TrackId SourceTrackId,
        TrackId TargetTrackId,
        string RelationType);
}
