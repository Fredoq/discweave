using DiscWeave.Application.Search;
using DiscWeave.Infrastructure.Persistence.Search;

namespace DiscWeave.Infrastructure.Persistence.Queries;

public sealed partial class CollectionSearchQueries
{
    private static IOrderedQueryable<SearchDocument> OrderDocuments(
        IQueryable<SearchDocument> documentsQuery, CollectionSearchSort sort)
    {
        return sort switch
        {
            CollectionSearchSort.AddedNewest => documentsQuery
                .OrderByDescending(document => document.EntityId.ToString().Substring(14, 1) == "7")
                .ThenByDescending(document => document.EntityId.ToString().Substring(14, 1) == "7"
                    ? document.EntityId.ToString().Substring(0, 13) : string.Empty),
            CollectionSearchSort.AddedOldest => documentsQuery
                .OrderByDescending(document => document.EntityId.ToString().Substring(14, 1) == "7")
                .ThenBy(document => document.EntityId.ToString().Substring(14, 1) == "7"
                    ? document.EntityId.ToString().Substring(0, 13) : string.Empty),
            CollectionSearchSort.Default => documentsQuery.OrderBy(document => document.Title),
            _ => throw new ArgumentOutOfRangeException(nameof(sort), "Search sort order is invalid")
        };
    }
}
