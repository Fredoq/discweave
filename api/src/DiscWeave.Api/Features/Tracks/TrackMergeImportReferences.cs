using System.Text.Json;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace DiscWeave.Api.Features.Tracks;

internal sealed class TrackMergeImportReferences
{
    private readonly IReadOnlySet<TrackId> _duplicateIds;
    private readonly List<ReleaseImportDraft> _drafts;
    private readonly List<ReleaseImportDraftTrack> _rows;
    private readonly List<ReleaseImportRelationSuggestion> _suggestions;

    private TrackMergeImportReferences(
        IReadOnlySet<TrackId> duplicateIds,
        List<ReleaseImportDraft> drafts,
        List<ReleaseImportDraftTrack> rows,
        List<ReleaseImportRelationSuggestion> suggestions,
        IReadOnlyList<string> fingerprintInputs)
    {
        _duplicateIds = duplicateIds;
        _drafts = drafts;
        _rows = rows;
        _suggestions = suggestions;
        FingerprintInputs = fingerprintInputs;
        ReferenceCount = rows.Count(row => IsDuplicate(row.SelectedTrackId)) +
            drafts.Sum(draft =>
                draft.SelectedOriginalBinding.Match(binding => IsDuplicate(binding.SourceTrackId) ? 1 : 0, () => 0) +
                draft.LocalProvenanceSelection.Match(selection => selection.SelectedTrackId.Match(id => IsDuplicate(id) ? 1 : 0, () => 0), () => 0)) +
            suggestions.Sum(suggestion => CountReferences(suggestion.SuggestedPayload) + CountReferences(suggestion.ReviewedPayload));
    }

    public int ReferenceCount { get; }
    public IReadOnlyList<string> FingerprintInputs { get; }

    public static async Task<TrackMergeImportReferences> LoadAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlySet<TrackId> duplicateIds,
        CancellationToken cancellationToken)
    {
        // Include confirmed and archived imports: their persisted foreign keys still matter.
        List<ReleaseImportSession> sessions = await context.ReleaseImportSessions.Where(item => item.CollectionId == collectionId).ToListAsync(cancellationToken);
        List<ReleaseImportDraft> drafts = await context.ReleaseImportDrafts.Where(item => item.CollectionId == collectionId).ToListAsync(cancellationToken);
        List<ReleaseImportDraftTrack> rows = await context.ReleaseImportDraftTracks.Where(item => item.CollectionId == collectionId).ToListAsync(cancellationToken);
        List<ReleaseImportRelationSuggestion> suggestions = await context.ReleaseImportRelationSuggestions.Where(item => item.CollectionId == collectionId).ToListAsync(cancellationToken);
        List<string> fingerprintInputs = [];
        foreach (object entity in sessions.Cast<object>().Concat(drafts).Concat(rows).Concat(suggestions))
        {
            EntityEntry entry = context.Entry(entity);
            fingerprintInputs.Add(JsonSerializer.Serialize(new
            {
                Type = entry.Metadata.Name,
                Properties = entry.Properties.OrderBy(property => property.Metadata.Name, StringComparer.Ordinal)
                    .Select(property => new { property.Metadata.Name, Value = property.CurrentValue }).ToArray()
            }));
        }

        fingerprintInputs.Sort(StringComparer.Ordinal);
        return new TrackMergeImportReferences(duplicateIds, drafts, rows, suggestions, fingerprintInputs);
    }

    public IReadOnlyList<TrackMergeConflictResponse> GetConflicts(TrackId keeperId)
    {
        List<TrackMergeConflictResponse> conflicts = [];
        var activeDraftIds = _drafts.Where(draft => draft.Status is not ReleaseImportDraftStatus.Confirmed and
            not ReleaseImportDraftStatus.Skipped).Select(draft => draft.Id).ToHashSet();
        if (_rows.Any(row => activeDraftIds.Contains(row.DraftId) && IsDuplicate(row.SelectedTrackId)) ||
            _drafts.Any(draft => activeDraftIds.Contains(draft.Id) && draft.LocalProvenanceSelection.Match(
                selection => selection.SelectedTrackId.Match(id => IsDuplicate(id), () => false), () => false)))
        {
            conflicts.Add(new TrackMergeConflictResponse("track.merge_import_review_required",
                "An unfinished import links to a duplicate Track and could overwrite the kept Track; review or unlink that import before merging"));
        }

        if (_suggestions.Any(suggestion => Collapses(suggestion.SuggestedPayload, keeperId) ||
            Collapses(suggestion.ReviewedPayload, keeperId)) ||
            _drafts.Any(draft => draft.SelectedOriginalBinding.Match(binding =>
                Collapses(new ReleaseImportRelationSuggestionPayload(
                    ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(binding.SourceTrackId),
                    ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(binding.DraftTrackId), null), keeperId), () => false)))
        {
            conflicts.Add(new TrackMergeConflictResponse("track.merge_import_relation_conflict",
                "Merging would collapse stored import relation evidence onto the same Track; these records cannot be merged while that evidence connects them"));
        }

        return conflicts;
    }

    public void Apply(TrackId keeperId)
    {
        if (GetConflicts(keeperId).Count != 0)
        {
            throw new InvalidOperationException("Import references must be resolved before merging Tracks");
        }

        HashSet<ReleaseImportDraftId> changedDraftIds = [];
        // Each filter performs one retarget attempt per item, in the existing source order.
        foreach (ReleaseImportDraftTrack row in _rows.Where(row => row.RetargetMergedTrack(_duplicateIds, keeperId)))
        {
            _ = changedDraftIds.Add(row.DraftId);
        }

        foreach (ReleaseImportRelationSuggestion suggestion in _suggestions.Where(suggestion => suggestion.RetargetMergedTrackReferences(_duplicateIds, keeperId)))
        {
            _ = changedDraftIds.Add(suggestion.DraftId);
        }

        foreach (ReleaseImportDraft draft in _drafts)
        {
            _ = draft.RetargetMergedTrackReferences(_duplicateIds, keeperId, changedDraftIds.Contains(draft.Id));
        }
    }

    private bool IsDuplicate(TrackId? id)
    {
        return id is { } value && _duplicateIds.Contains(value);
    }

    private int CountReferences(ReleaseImportRelationSuggestionPayload payload)
    {
        return (IsDuplicateEndpoint(payload.Source) ? 1 : 0) + (IsDuplicateEndpoint(payload.Target) ? 1 : 0);
    }

    private bool IsDuplicateEndpoint(ReleaseImportRelationSuggestionEndpoint? endpoint)
    {
        return endpoint?.Kind == ReleaseImportRelationSuggestionEndpointKind.ExistingTrack &&
            IsDuplicate(new TrackId(endpoint.TrackId));
    }

    private bool Collapses(ReleaseImportRelationSuggestionPayload payload, TrackId keeperId)
    {
        TrackId? source = Resolve(payload.Source);
        TrackId? target = Resolve(payload.Target);
        return source.HasValue && target.HasValue &&
            (IsDuplicate(source) || IsDuplicate(target)) &&
            (IsDuplicate(source) ? keeperId : source) == (IsDuplicate(target) ? keeperId : target);
    }

    private TrackId? Resolve(ReleaseImportRelationSuggestionEndpoint? endpoint)
    {
        return endpoint switch
        {
            null => null,
            { Kind: ReleaseImportRelationSuggestionEndpointKind.ExistingTrack } => new TrackId(endpoint.TrackId),
            _ => _rows.Find(row => row.Id.Value == endpoint.TrackId)?.SelectedTrackId
        };
    }
}
