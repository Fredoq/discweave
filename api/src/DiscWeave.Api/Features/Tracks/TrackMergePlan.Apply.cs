using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.Playlists;
using DiscWeave.Domain.Ratings;
using DiscWeave.Domain.Relations;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Tracks;

internal sealed partial class TrackMergePlan
{
    public async Task ApplyAsync(DiscWeaveDbContext context, CancellationToken cancellationToken)
    {
        if (Conflicts.Count > 0 || context.Database.CurrentTransaction is null)
        {
            throw new InvalidOperationException("Track merge requires a conflict-free plan and an active transaction");
        }

        Credit[][] creditGroups = [.. _credits.Where(credit => credit.Target is TrackCreditTarget target && IsSelected(target.TrackId))
            .GroupBy(credit => credit.Contributor.ArtistId).Select(group => group.OrderBy(credit =>
                credit.Target is TrackCreditTarget target && target.TrackId == _keeper.Id ? 0 : 1).ThenBy(credit => credit.Id.Value).ToArray())];
        RatingValue[][] ratingGroups = [.. SelectedRatings().GroupBy(rating => rating.CriterionId).Select(group => group.OrderBy(rating =>
            rating.Target is TrackRatingTarget target && target.TrackId == _keeper.Id ? 0 : 1).ThenBy(rating => rating.Id.Value).ToArray())];
        TrackRelation[][] relationGroups = [.. _relations.GroupBy(relation => TrackRelationIdentity.From(Remap(relation.SourceTrackId), Remap(relation.TargetTrackId), relation.RelationType).Value)
            .Select(group => group.OrderBy(relation => _duplicates.Contains(relation.SourceTrackId) || _duplicates.Contains(relation.TargetTrackId) ? 1 : 0)
                .ThenBy(relation => relation.Id.Value).ToArray())];

        // Remove only semantically redundant dependents before updating unique identities.
        // All three save stages remain inside the caller's transaction, including search rebuilds.
        context.Credits.RemoveRange(creditGroups.SelectMany(group => group.Skip(1)));
        context.RatingValues.RemoveRange(ratingGroups.SelectMany(group => group.Skip(1)));
        context.TrackRelations.RemoveRange(relationGroups.SelectMany(group => group.Skip(1)));
        _ = await context.SaveChangesAsync(cancellationToken);

        foreach (Credit[] group in creditGroups)
        {
            Credit retained = group[0];
            retained.Update(retained.Contributor, CreditTarget.ForTrack(_keeper.Id), [.. group.SelectMany(credit => credit.Roles).Distinct(StringComparer.Ordinal)]);
        }
        foreach (RatingValue[] group in ratingGroups)
        {
            group[0].RelinkTrack(_keeper.Id);
        }
        foreach (TrackRelation[] group in relationGroups)
        {
            TrackRelation retained = group[0];
            retained.Update(Remap(retained.SourceTrackId), Remap(retained.TargetTrackId), retained.RelationType);
        }
        foreach (ReleaseTrack row in _releaseRows.Where(row => row.TrackId is { } id && _duplicates.Contains(id)))
        {
            row.RelinkTrack(_keeper.Id);
        }
        foreach (PlaylistEntry entry in _playlists.SelectMany(playlist => playlist.Entries).Where(IsDuplicateEntry))
        {
            entry.RelinkTrack(_keeper.Id);
        }

        UnionMetadata();
        Imports.Apply(_keeper.Id);
        _ = await context.SaveChangesAsync(cancellationToken);
        context.Tracks.RemoveRange(_tracks.Where(track => _duplicates.Contains(track.Id)));
        _ = await context.SaveChangesAsync(cancellationToken);
    }

    private void UnionMetadata()
    {
        Cataloging cataloging = _keeper.Cataloging;
        foreach (Track duplicate in _tracks.Where(track => _duplicates.Contains(track.Id)).OrderBy(track => track.Id.Value))
        {
            foreach (Genre genre in duplicate.Cataloging.Genres)
            {
                cataloging = cataloging.WithGenre(Genre.FromName(genre.Name));
            }
            foreach (Tag tag in duplicate.Cataloging.Tags)
            {
                cataloging = cataloging.WithTag(Tag.FromName(tag.Name));
            }
            // Clone incoming owned values rather than moving them between tracked owners.
            // Domain union preserves the newest authoritative metadata for each identity.
            _keeper.UnionExternalSources([.. duplicate.ExternalSources.Select(source =>
                ExternalSourceReference.Create(source.ProviderName, source.ResourceType, source.ExternalId, source.SourceUrl, source.AppliedAt))]);
        }
        _keeper.UpdateCataloging(cataloging);
    }
}
