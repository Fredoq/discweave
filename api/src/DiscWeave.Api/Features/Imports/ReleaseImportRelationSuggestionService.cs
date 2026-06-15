using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

internal static class ReleaseImportRelationSuggestionService
{
    public static async Task GenerateAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        CancellationToken cancellationToken)
    {
        string[] activeRelationTypeCodeValues = await context.CollectionDictionaryEntries.AsNoTracking()
            .Where(entry => entry.CollectionId == collectionId &&
                entry.Kind == DictionaryKind.TrackRelationType &&
                entry.IsActive)
            .Select(entry => entry.Code)
            .ToArrayAsync(cancellationToken);
        HashSet<string> activeRelationTypeCodes = [.. activeRelationTypeCodeValues];
        if (activeRelationTypeCodes.Count == 0)
        {
            return;
        }

        TrackRelationParserRule[] rules = await context.TrackRelationParserRules.AsNoTracking()
            .Where(rule => rule.CollectionId == collectionId &&
                rule.IsActive &&
                rule.MatchMode == TrackRelationParserRuleMatchMode.ExactLastParentheticalToken &&
                activeRelationTypeCodes.Contains(rule.RelationTypeCode))
            .OrderBy(rule => rule.SortOrder)
            .ThenBy(rule => rule.RelationTypeCode)
            .ThenBy(rule => rule.Alias)
            .ToArrayAsync(cancellationToken);
        if (rules.Length == 0)
        {
            return;
        }

        ReleaseImportDraftId[] draftIds = await context.ReleaseImportDrafts.AsNoTracking()
            .Where(draft => draft.CollectionId == collectionId && draft.SessionId == sessionId)
            .Select(draft => draft.Id)
            .ToArrayAsync(cancellationToken);
        if (draftIds.Length == 0)
        {
            return;
        }

        ReleaseImportDraftTrack[] draftTracks = await context.ReleaseImportDraftTracks.AsNoTracking()
            .Where(track => track.CollectionId == collectionId && draftIds.Contains(track.DraftId))
            .ToArrayAsync(cancellationToken);
        ReleaseImportDraftTrack[] candidateDraftTracks = [.. draftTracks.Where(track => !track.IsSkipped)];
        if (candidateDraftTracks.Length == 0)
        {
            return;
        }

        Track[] existingTracks = await context.Tracks.AsNoTracking()
            .Where(track => track.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);

        HashSet<ExistingSuggestionKey> existingSuggestionKeys = [.. (await context.ReleaseImportRelationSuggestions.AsNoTracking()
            .Where(suggestion => suggestion.CollectionId == collectionId && suggestion.SessionId == sessionId)
            .ToArrayAsync(cancellationToken))
            .Select(suggestion => new ExistingSuggestionKey(
                suggestion.SuggestedPayload.Source.TrackId,
                RelationSuggestionAnalyzer.NormalizeTitle(suggestion.Token)))];

        foreach (ReleaseImportDraftTrack sourceTrack in candidateDraftTracks)
        {
            RelationSuggestionAnalyzer.TitleToken? titleToken = RelationSuggestionAnalyzer.TrySplitLastParenthetical(sourceTrack.Title);
            if (titleToken is null)
            {
                continue;
            }

            TrackRelationParserRule? rule = RelationSuggestionAnalyzer.MatchRule(titleToken.Token, rules);
            if (rule is null)
            {
                continue;
            }

            var existingKey = new ExistingSuggestionKey(sourceTrack.Id.Value, RelationSuggestionAnalyzer.NormalizeTitle(titleToken.Token));
            if (existingSuggestionKeys.Contains(existingKey))
            {
                continue;
            }

            string normalizedBaseTitle = RelationSuggestionAnalyzer.NormalizeTitle(titleToken.BaseTitle);
            RelationSuggestionTarget[] targets = FindTargets(sourceTrack, normalizedBaseTitle, candidateDraftTracks, existingTracks);
            if (targets.Length == 0)
            {
                continue;
            }

            ReleaseImportRelationSuggestionEndpoint? target = targets.Length == 1 && CanPersistTarget(sourceTrack, targets[0])
                ? targets[0].Endpoint
                : null;
            var payload = new ReleaseImportRelationSuggestionPayload(
                ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(sourceTrack.Id),
                target,
                rule.RelationTypeCode);
            var suggestion = ReleaseImportRelationSuggestion.Create(
                collectionId,
                sessionId,
                sourceTrack.DraftId,
                ReleaseImportRelationSuggestionId.New(),
                titleToken.Token,
                rule.Confidence,
                payload);

            _ = context.ReleaseImportRelationSuggestions.Add(suggestion);
            _ = existingSuggestionKeys.Add(existingKey);
        }

        _ = await context.SaveChangesAsync(cancellationToken);
    }

    private static RelationSuggestionTarget[] FindTargets(
        ReleaseImportDraftTrack sourceTrack,
        string normalizedBaseTitle,
        IReadOnlyList<ReleaseImportDraftTrack> draftTracks,
        IReadOnlyList<Track> existingTracks)
    {
        return
        [
            .. draftTracks
                .Where(track => track.Id != sourceTrack.Id &&
                    RelationSuggestionAnalyzer.NormalizeTitle(track.Title) == normalizedBaseTitle)
                .Select(track => new RelationSuggestionTarget(
                    ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(track.Id),
                    track.DraftId)),
            .. existingTracks
                .Where(track => RelationSuggestionAnalyzer.NormalizeTitle(track.Title) == normalizedBaseTitle)
                .Select(track => new RelationSuggestionTarget(
                    ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(track.Id),
                    null))
        ];
    }

    private static bool CanPersistTarget(ReleaseImportDraftTrack sourceTrack, RelationSuggestionTarget target)
    {
        return target.Endpoint.Kind == ReleaseImportRelationSuggestionEndpointKind.ExistingTrack ||
            target.DraftId == sourceTrack.DraftId;
    }

    private sealed record ExistingSuggestionKey(Guid SourceTrackId, string NormalizedToken);

    private sealed record RelationSuggestionTarget(
        ReleaseImportRelationSuggestionEndpoint Endpoint,
        ReleaseImportDraftId? DraftId);
}
