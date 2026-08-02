using DiscWeave.Application.Catalog;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Persistence.Queries;

internal sealed class ExternalSourceLookup : IExternalSourceLookup
{
    private readonly DiscWeaveDbContext _context;

    public ExternalSourceLookup(DiscWeaveDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<Release>> FindReleasesAsync(
        CollectionId collectionId,
        IReadOnlyCollection<ExternalSourceLookupIdentity> identities,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(identities);
        if (identities.Count == 0)
        {
            return [];
        }

        Dictionary<ReleaseId, Release> matches = [];
        foreach (ExternalSourceLookupIdentity identity in identities.Distinct())
        {
            Guid[] releaseIds = await _context.Database.SqlQuery<Guid>($"""
                SELECT release_id AS "Value"
                FROM release_external_sources
                WHERE collection_id = {collectionId.Value}
                  AND provider_name = {identity.ProviderCode}
                  AND resource_type = {identity.ResourceType}
                  AND external_id = {identity.ExternalId}
                """).ToArrayAsync(cancellationToken);
            ReleaseId[] typedReleaseIds = [.. releaseIds.Select(id => new ReleaseId(id))];
            Release[] releases = await _context.Releases
                .Where(release => release.CollectionId == collectionId &&
                    typedReleaseIds.Contains(release.Id))
                .ToArrayAsync(cancellationToken);
            foreach (Release release in releases)
            {
                matches[release.Id] = release;
            }
        }

        return [.. matches.Values.OrderBy(release => release.Id.Value)];
    }

    public async Task<IReadOnlyList<Track>> FindTracksAsync(
        CollectionId collectionId,
        IReadOnlyCollection<ExternalSourceLookupIdentity> identities,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(identities);
        if (identities.Count == 0)
        {
            return [];
        }

        Dictionary<TrackId, Track> matches = [];
        foreach (ExternalSourceLookupIdentity identity in identities.Distinct())
        {
            Guid[] trackIds = await _context.Database.SqlQuery<Guid>($"""
                SELECT track_id AS "Value"
                FROM track_external_sources
                WHERE collection_id = {collectionId.Value}
                  AND provider_name = {identity.ProviderCode}
                  AND resource_type = {identity.ResourceType}
                  AND external_id = {identity.ExternalId}
                """).ToArrayAsync(cancellationToken);
            TrackId[] typedTrackIds = [.. trackIds.Select(id => new TrackId(id))];
            Track[] tracks = await _context.Tracks
                .Where(track => track.CollectionId == collectionId &&
                    typedTrackIds.Contains(track.Id))
                .ToArrayAsync(cancellationToken);
            foreach (Track track in tracks)
            {
                matches[track.Id] = track;
            }
        }

        return [.. matches.Values.OrderBy(track => track.Id.Value)];
    }
}
