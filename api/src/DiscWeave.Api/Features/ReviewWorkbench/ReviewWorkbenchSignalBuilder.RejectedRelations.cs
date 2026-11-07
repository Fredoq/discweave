using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.ReviewWorkbench;

public static partial class ReviewWorkbenchSignalBuilder
{
    private static async Task<HashSet<TrackRelationIdentity>> RejectedRelationIdentitiesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        RelationFileEvidence fileEvidence,
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
        Dictionary<Guid, TrackId> resolvedTracks = ResolveConfirmedDraftTracks(confirmedDrafts, draftTracks, fileEvidence);
        HashSet<TrackRelationIdentity> identities = [];
        foreach (ReleaseImportRelationSuggestionPayload payload in rejected.Select(suggestion => suggestion.ReviewedPayload))
        {
            TrackId? source = ResolveSuggestionTrack(payload.Source, resolvedTracks);
            TrackId? target = payload.Target is { } endpoint ? ResolveSuggestionTrack(endpoint, resolvedTracks) : null;
            if (source is { } sourceId && target is { } targetId && !string.IsNullOrWhiteSpace(payload.RelationTypeCode))
            {
                _ = identities.Add(new TrackRelationIdentity(sourceId, targetId, payload.RelationTypeCode));
            }
        }

        return identities;
    }

    private static Dictionary<Guid, TrackId> ResolveConfirmedDraftTracks(
        IReadOnlyList<ReleaseImportDraft> confirmedDrafts,
        IReadOnlyList<ReleaseImportDraftTrack> draftTracks,
        RelationFileEvidence fileEvidence)
    {
        var resolvedTracks = draftTracks.Where(track => track.SelectedTrackId.HasValue)
            .ToDictionary(track => track.Id.Value, track => track.SelectedTrackId.GetValueOrDefault());
        var filePathsById = fileEvidence.LocalAudioFiles.ToDictionary(file => file.Id, file => file.Path.Value);
        var releaseTracksById = fileEvidence.ReleaseTracks.Where(track => track.TrackId.HasValue)
            .ToDictionary(track => track.Id);
        var tracksByFilePathAndRelease = fileEvidence.DigitalTrackFileLinks
            .Where(link => filePathsById.ContainsKey(link.LocalAudioFileId) && releaseTracksById.ContainsKey(link.ReleaseTrackId))
            .Select(link => (Path: filePathsById[link.LocalAudioFileId], Row: releaseTracksById[link.ReleaseTrackId]))
            .GroupBy(item => (item.Path, item.Row.ReleaseId))
            .ToDictionary(group => group.Key, group => group.Select(item => item.Row.TrackId.GetValueOrDefault()).Distinct().ToArray());
        var releasesByDraft = confirmedDrafts.ToDictionary(draft => draft.Id, draft => draft.ConfirmedReleaseId);
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

        return resolvedTracks;
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

    private sealed record RelationFileEvidence(
        IReadOnlyList<ReleaseTrack> ReleaseTracks,
        IReadOnlyList<LocalAudioFile> LocalAudioFiles,
        IReadOnlyList<DigitalTrackFileLink> DigitalTrackFileLinks);
}
