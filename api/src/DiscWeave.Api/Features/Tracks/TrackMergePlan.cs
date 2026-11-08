using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.Playlists;
using DiscWeave.Domain.Ratings;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Tracks;

internal sealed partial class TrackMergePlan
{
    private readonly Track _keeper;
    private readonly Track[] _tracks;
    private readonly HashSet<TrackId> _duplicates;
    private readonly ReleaseTrack[] _releaseRows;
    private readonly Playlist[] _playlists;
    private readonly Credit[] _credits;
    private readonly RatingValue[] _ratings;
    private readonly TrackRelation[] _relations;
    private readonly IReadOnlyList<string> _stackTypes;

    private TrackMergePlan(Track keeper, HashSet<TrackId> duplicates, MergeDependencies dependencies)
    {
        _keeper = keeper;
        _tracks = dependencies.Tracks;
        _duplicates = duplicates;
        _releaseRows = dependencies.ReleaseRows;
        _playlists = dependencies.Playlists;
        _credits = dependencies.Credits;
        _ratings = dependencies.Ratings;
        _relations = dependencies.Relations;
        _stackTypes = dependencies.StackTypes;
        Imports = dependencies.Imports;
        Conflicts = FindConflicts();
        Counts = new TrackMergeCountsResponse(
            _releaseRows.Count(row => row.TrackId is { } id && duplicates.Contains(id)), dependencies.LinkedFiles,
            _playlists.Sum(playlist => playlist.Entries.Count(IsDuplicateEntry)),
            _credits.Count(credit => credit.Target is TrackCreditTarget target && duplicates.Contains(target.TrackId)),
            _ratings.Count(rating => rating.Target is TrackRatingTarget target && duplicates.Contains(target.TrackId)),
            _relations.Count(relation => duplicates.Contains(relation.SourceTrackId) || duplicates.Contains(relation.TargetTrackId)),
            Imports.ReferenceCount);
    }

    public TrackMergeImportReferences Imports { get; }
    public TrackMergeCountsResponse Counts { get; }
    public IReadOnlyList<TrackMergeConflictResponse> Conflicts { get; }
    public Track[] SelectedTracks => [.. _tracks.Where(track => IsSelected(track.Id)).OrderBy(track => track.Id == _keeper.Id ? 0 : 1).ThenBy(track => track.Id.Value)];

    public static async Task<TrackMergePlan?> LoadAsync(DiscWeaveDbContext context, CollectionId collectionId,
        TrackMergeRequest request, CancellationToken cancellationToken)
    {
        Track[] tracks = await context.Tracks.Where(track => track.CollectionId == collectionId).ToArrayAsync(cancellationToken);
        Track? keeper = tracks.SingleOrDefault(track => track.Id.Value == request.KeeperTrackId);
        HashSet<TrackId> duplicates = [.. request.DuplicateTrackIds.Select(id => new TrackId(id))];
        if (keeper is null || duplicates.Any(id => !tracks.Any(track => track.Id == id)))
        {
            return null;
        }

        ReleaseTrack[] rows = await context.ReleaseTracks.Where(row => row.CollectionId == collectionId).ToArrayAsync(cancellationToken);
        DigitalTrackFileLink[] links = await context.DigitalTrackFileLinks.Where(link => link.CollectionId == collectionId).ToArrayAsync(cancellationToken);
        // File metadata participates in the reviewed snapshot, but no file entity or bytes are modified.
        _ = await context.LocalAudioFiles.Where(file => file.CollectionId == collectionId).ToArrayAsync(cancellationToken);
        Playlist[] playlists = await context.Playlists.Where(playlist => playlist.CollectionId == collectionId).ToArrayAsync(cancellationToken);
        Credit[] credits = await context.Credits.Where(credit => credit.CollectionId == collectionId).ToArrayAsync(cancellationToken);
        RatingValue[] ratings = await context.RatingValues.Where(rating => rating.CollectionId == collectionId).ToArrayAsync(cancellationToken);
        TrackRelation[] relations = await context.TrackRelations.Where(relation => relation.CollectionId == collectionId).ToArrayAsync(cancellationToken);
        TrackStackSettings? settings = await context.TrackStackSettings.SingleOrDefaultAsync(item => item.CollectionId == collectionId, cancellationToken);
        CollectionDictionaryEntry[] types = await context.CollectionDictionaryEntries.Where(entry => entry.CollectionId == collectionId && entry.Kind == DictionaryKind.TrackRelationType).ToArrayAsync(cancellationToken);
        IReadOnlyList<string> stackTypes = settings?.DefaultRelationTypeCodes ??
            [.. types.Where(type => type.IsActive && CollectionDictionaryDefaults.DefaultTrackStackRelationTypeCodes.Contains(type.Code)).Select(type => type.Code)];
        TrackMergeImportReferences imports = await TrackMergeImportReferences.LoadAsync(context, collectionId, duplicates, cancellationToken);
        HashSet<ReleaseTrackId> duplicateRows = [.. rows.Where(row => row.TrackId is { } id && duplicates.Contains(id)).Select(row => row.Id)];
        return new TrackMergePlan(keeper, duplicates, new MergeDependencies
        {
            Tracks = tracks,
            ReleaseRows = rows,
            Playlists = playlists,
            Credits = credits,
            Ratings = ratings,
            Relations = relations,
            StackTypes = stackTypes,
            Imports = imports,
            LinkedFiles = links.Count(link => duplicateRows.Contains(link.ReleaseTrackId))
        });
    }

    private TrackId Remap(TrackId id) => _duplicates.Contains(id) ? _keeper.Id : id;
    private bool IsSelected(TrackId id) => id == _keeper.Id || _duplicates.Contains(id);
    private bool IsDuplicateEntry(PlaylistEntry entry) => entry.TrackId.Match(_duplicates.Contains, () => false);

    private sealed record MergeDependencies
    {
        public required Track[] Tracks { get; init; }
        public required ReleaseTrack[] ReleaseRows { get; init; }
        public required Playlist[] Playlists { get; init; }
        public required Credit[] Credits { get; init; }
        public required RatingValue[] Ratings { get; init; }
        public required TrackRelation[] Relations { get; init; }
        public required IReadOnlyList<string> StackTypes { get; init; }
        public required TrackMergeImportReferences Imports { get; init; }
        public int LinkedFiles { get; init; }
    }
}
