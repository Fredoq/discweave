using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Persistence.Queries;

public sealed partial class LocalOriginalCandidateDataSource
    : ILocalOriginalCandidateDataSource
{
    private const string ExternalSourcesNavigation = "_externalSources";
    private readonly DiscWeaveDbContext _context;

    public LocalOriginalCandidateDataSource(DiscWeaveDbContext context)
    {
        _context = context;
    }

    public async Task<LocalOriginalCandidateSnapshot> LoadAsync(
        CollectionId collectionId,
        TrackId sourceTrackId,
        CancellationToken cancellationToken)
    {
        Track[] tracks = await _context.Tracks
            .AsNoTracking()
            .Include(ExternalSourcesNavigation)
            .Where(track => track.CollectionId == collectionId)
            .OrderBy(track => track.Id)
            .ToArrayAsync(cancellationToken);
        Track? source = tracks.SingleOrDefault(track => track.Id == sourceTrackId);
        if (source is null)
        {
            return Empty();
        }

        TrackRelation[] relations = await _context.TrackRelations
            .AsNoTracking()
            .Where(relation => relation.CollectionId == collectionId)
            .OrderBy(relation => relation.SourceTrackId)
            .ThenBy(relation => relation.TargetTrackId)
            .ThenBy(relation => relation.RelationType)
            .ToArrayAsync(cancellationToken);
        IReadOnlyList<string> enabledRelationTypeCodes =
            await TrackStackSettingsReader.GetDefaultRelationTypeCodesAsync(
                _context,
                collectionId,
                cancellationToken);
        if (source.Metadata.IsOriginal)
        {
            return CreateSnapshot(
                collectionId,
                source,
                tracks,
                relations,
                [],
                [],
                [],
                enabledRelationTypeCodes,
                []);
        }

        TrackRelationParserRule[] parserRules = await _context.TrackRelationParserRules
            .AsNoTracking()
            .Where(rule => rule.CollectionId == collectionId)
            .OrderBy(rule => rule.SortOrder)
            .ThenBy(rule => rule.RelationTypeCode)
            .ThenBy(rule => rule.Alias)
            .ThenBy(rule => rule.Id)
            .ToArrayAsync(cancellationToken);
        TrackId[] relevantTrackIds =
        [
            .. tracks
                .Where(track => SharesBaseTitle(source, track, parserRules))
                .Select(track => track.Id)
        ];

        Release[] releases = await _context.Releases
            .AsNoTracking()
            .Where(release =>
                release.CollectionId == collectionId &&
                release.Tracklist.Any(item =>
                    item.TrackId.HasValue &&
                    relevantTrackIds.Contains(item.TrackId.Value)))
            .OrderBy(release => release.Id)
            .ToArrayAsync(cancellationToken);
        ReleaseId[] relevantReleaseIds =
        [.. releases.Select(release => release.Id)];
        Credit[] credits = await _context.Credits
            .AsNoTracking()
            .Where(credit =>
                credit.CollectionId == collectionId &&
                ((EF.Property<TrackId?>(credit, "_targetTrackId").HasValue &&
                    relevantTrackIds.Any(trackId =>
                        EF.Property<TrackId?>(credit, "_targetTrackId") == trackId)) ||
                (EF.Property<ReleaseId?>(credit, "_targetReleaseId").HasValue &&
                    relevantReleaseIds.Any(releaseId =>
                        EF.Property<ReleaseId?>(credit, "_targetReleaseId") == releaseId))))
            .OrderBy(credit => credit.Id)
            .ToArrayAsync(cancellationToken);
        ArtistId[] relevantArtistIds =
        [.. credits.Select(credit => credit.Contributor.ArtistId).Distinct()];
        Artist[] artists = await _context.Artists
            .AsNoTracking()
            .Where(artist =>
                artist.CollectionId == collectionId &&
                relevantArtistIds.Contains(artist.Id))
            .OrderBy(artist => artist.Id)
            .ToArrayAsync(cancellationToken);

        return CreateSnapshot(
            collectionId,
            source,
            tracks,
            relations,
            releases,
            credits,
            artists,
            enabledRelationTypeCodes,
            parserRules);
    }

    private static LocalOriginalCandidateSnapshot Empty()
    {
        return new LocalOriginalCandidateSnapshot
        {
            Source = null,
            Candidates = [],
            StackTracks = [],
            StackRelations = [],
            Appearances = [],
            PrimaryArtists = [],
            Credits = [],
            EnabledStackRelationTypeCodes = [],
            ParserRules = []
        };
    }
}
