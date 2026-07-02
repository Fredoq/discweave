using DiscWeave.Application.ExternalSources;
using DiscWeave.Application.Search;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence.Search;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Persistence.Queries;

public sealed partial class CollectionSearchQueries
{
    private async Task<Dictionary<Guid, string>> LoadArtistIdentityHintsAsync(
        IEnumerable<SearchDocument> documents,
        CancellationToken cancellationToken)
    {
        ArtistId[] artistIds =
        [
            .. documents
                .Where(document => document.EntityType == "artist")
                .Select(document => new ArtistId(document.EntityId))
                .Distinct()
        ];

        if (artistIds.Length == 0)
        {
            return [];
        }

        Artist[] artists = await _context.Artists.AsNoTracking()
            .Include("_externalSources")
            .Where(artist => artist.CollectionId == _collectionId && artistIds.Contains(artist.Id))
            .ToArrayAsync(cancellationToken);

        return artists
            .Select(artist => new { artist.Id.Value, Hint = ExternalSourceIdentityHintFormatter.ArtistIdentityHint(artist.ExternalSources) })
            .Where(artist => artist.Hint is not null)
            .ToDictionary(artist => artist.Value, artist => artist.Hint!);
    }

    private static SearchResultReadModel ReadResult(
        SearchDocument document,
        decimal rank,
        IReadOnlyDictionary<Guid, string> identityHints)
    {
        var facets = new SearchResultFacetsReadModel(
            [.. SearchDocumentText.UnpackFacet(document.RoleFacet).Select(DisplayRole)],
            SearchDocumentText.UnpackFacet(document.MediaFacet),
            [.. SearchDocumentText.UnpackFacet(document.StatusFacet).Select(DisplayStatus)],
            SearchDocumentText.UnpackFacet(document.TagFacet),
            document.LabelId,
            [.. SearchDocumentText.UnpackFacet(document.CollectorSignalFacet).Select(DisplaySignal)]);

        return new SearchResultReadModel(
            document.EntityId,
            document.EntityType,
            document.Title,
            document.EntityType == "artist" ? identityHints.GetValueOrDefault(document.EntityId) : null,
            document.Subtitle,
            document.Summary,
            SearchDocumentText.Unpack(document.MatchedFields),
            SearchDocumentText.Unpack(document.Snippets),
            facets,
            rank);
    }
}
