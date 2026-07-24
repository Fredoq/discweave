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
        Release[] releases = await _context.Releases
            .AsNoTracking()
            .Where(release => release.CollectionId == collectionId)
            .OrderBy(release => release.Id)
            .ToArrayAsync(cancellationToken);
        Credit[] credits = await _context.Credits
            .AsNoTracking()
            .Where(credit => credit.CollectionId == collectionId)
            .OrderBy(credit => credit.Id)
            .ToArrayAsync(cancellationToken);
        Artist[] artists = await _context.Artists
            .AsNoTracking()
            .Where(artist => artist.CollectionId == collectionId)
            .OrderBy(artist => artist.Id)
            .ToArrayAsync(cancellationToken);
        IReadOnlyList<string> enabledRelationTypeCodes =
            await TrackStackSettingsReader.GetDefaultRelationTypeCodesAsync(
                _context,
                collectionId,
                cancellationToken);
        TrackRelationParserRule[] parserRules =
            await _context.TrackRelationParserRules
                .AsNoTracking()
                .Where(rule => rule.CollectionId == collectionId)
                .OrderBy(rule => rule.SortOrder)
                .ThenBy(rule => rule.RelationTypeCode)
                .ThenBy(rule => rule.Alias)
                .ThenBy(rule => rule.Id)
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
