using DiscWeave.Api.Features.Imports;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Optional;
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
        Dictionary<Guid, string> artistIdentities,
        IReadOnlyList<ReleaseTrack> releaseTracks,
        IReadOnlyList<LocalAudioFile> localAudioFiles,
        IReadOnlyList<DigitalTrackFileLink> digitalTrackFileLinks,
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
        HashSet<TrackRelationIdentity> rejectedRelations = await RejectedRelationIdentitiesAsync(
            context, collectionId, releaseTracks, localAudioFiles, digitalTrackFileLinks, cancellationToken);
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
            if (candidateTargets.Any(target => HasExpectedRelation(track.Id, target.Id, rule, existingRelations)))
            {
                continue;
            }

            Track[] missingRelationTargets =
            [
                .. candidateTargets.Where(target =>
                    artistIdentities.TryGetValue(track.Id.Value, out string? sourceArtists) &&
                    artistIdentities.TryGetValue(target.Id.Value, out string? targetArtists) &&
                    sourceArtists == targetArtists)
            ];
            if (missingRelationTargets.Length != 1 ||
                HasExpectedRelation(track.Id, missingRelationTargets[0].Id, rule, rejectedRelations))
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

    private static async Task<HashSet<TrackRelationIdentity>> RejectedRelationIdentitiesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyList<ReleaseTrack> releaseTracks,
        IReadOnlyList<LocalAudioFile> localAudioFiles,
        IReadOnlyList<DigitalTrackFileLink> digitalTrackFileLinks,
        CancellationToken cancellationToken)
    {
        ReleaseImportDraft[] confirmedDrafts = await context.ReleaseImportDrafts.AsNoTracking()
            .Where(draft => draft.CollectionId == collectionId && draft.Status == ReleaseImportDraftStatus.Confirmed)
            .ToArrayAsync(cancellationToken);
        ReleaseImportDraftId[] confirmedDraftIds = [.. confirmedDrafts.Select(draft => draft.Id)];
        ReleaseImportRelationSuggestion[] rejected = await context.ReleaseImportRelationSuggestions.AsNoTracking()
            .Where(suggestion => suggestion.CollectionId == collectionId &&
                confirmedDraftIds.Contains(suggestion.DraftId) &&
                suggestion.Decision == ReleaseImportRelationSuggestionDecision.Rejected)
            .ToArrayAsync(cancellationToken);
        if (rejected.Length == 0)
        {
            return [];
        }

        ReleaseImportDraftTrack[] draftTracks = await context.ReleaseImportDraftTracks.AsNoTracking()
            .Where(track => track.CollectionId == collectionId && confirmedDraftIds.Contains(track.DraftId))
            .ToArrayAsync(cancellationToken);
        var resolvedTracks = draftTracks.Where(track => track.SelectedTrackId.HasValue)
            .ToDictionary(track => track.Id.Value, track => track.SelectedTrackId!.Value);
        var filePathsById = localAudioFiles.ToDictionary(file => file.Id, file => file.Path.Value);
        var releaseTracksById = releaseTracks.Where(track => track.TrackId.HasValue)
            .ToDictionary(track => track.Id);
        Dictionary<(string Path, ReleaseId ReleaseId), TrackId[]> tracksByFilePathAndRelease = digitalTrackFileLinks
            .Where(link => filePathsById.ContainsKey(link.LocalAudioFileId) && releaseTracksById.ContainsKey(link.ReleaseTrackId))
            .Select(link => (Path: filePathsById[link.LocalAudioFileId], Row: releaseTracksById[link.ReleaseTrackId]))
            .GroupBy(item => (item.Path, item.Row.ReleaseId))
            .ToDictionary(group => group.Key, group => group.Select(item => item.Row.TrackId!.Value).Distinct().ToArray());
        Dictionary<ReleaseImportDraftId, ReleaseId?> releasesByDraft = confirmedDrafts.ToDictionary(draft => draft.Id, draft => draft.ConfirmedReleaseId);
        foreach (ReleaseImportDraftTrack draftTrack in draftTracks.Where(track =>
                     !track.IsSkipped && track.TrackMode != ReleaseImportTrackMode.ReleaseOnly && !track.SelectedTrackId.HasValue))
        {
            if (draftTrack.LocalFile is not PresentOptionalValue<ReleaseImportLocalFileDescriptor> localFile)
            {
                continue;
            }

            // Confirmation does not persist created track IDs on local drafts. Resolve through
            // their actual file links, never through a title or a possibly edited tracklist position.
            TrackId[] matches = releasesByDraft[draftTrack.DraftId] is { } releaseId
                ? tracksByFilePathAndRelease.GetValueOrDefault((localFile.Value.FilePath, releaseId)) ?? []
                : [];
            if (matches.Length == 1)
            {
                resolvedTracks[draftTrack.Id.Value] = matches[0];
            }
        }

        HashSet<TrackRelationIdentity> identities = [];
        foreach (ReleaseImportRelationSuggestion suggestion in rejected)
        {
            ReleaseImportRelationSuggestionPayload payload = suggestion.ReviewedPayload;
            TrackId? source = ResolveSuggestionTrack(payload.Source, resolvedTracks);
            TrackId? target = payload.Target is { } endpoint ? ResolveSuggestionTrack(endpoint, resolvedTracks) : null;
            if (source is { } sourceId && target is { } targetId && !string.IsNullOrWhiteSpace(payload.RelationTypeCode))
            {
                _ = identities.Add(new TrackRelationIdentity(sourceId, targetId, payload.RelationTypeCode));
            }
        }

        return identities;
    }

    private static TrackId? ResolveSuggestionTrack(
        ReleaseImportRelationSuggestionEndpoint endpoint,
        Dictionary<Guid, TrackId> resolvedTracks)
    {
        return endpoint.Kind switch
        {
            ReleaseImportRelationSuggestionEndpointKind.ExistingTrack => new TrackId(endpoint.TrackId),
            ReleaseImportRelationSuggestionEndpointKind.DraftTrack when resolvedTracks.TryGetValue(endpoint.TrackId, out TrackId id) => id,
            _ => null
        };
    }

    private readonly record struct TrackRelationIdentity(
        TrackId SourceTrackId,
        TrackId TargetTrackId,
        string RelationType);
}
