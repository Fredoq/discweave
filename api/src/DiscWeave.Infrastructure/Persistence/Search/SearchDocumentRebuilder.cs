using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace DiscWeave.Infrastructure.Persistence.Search;

internal static class SearchDocumentRebuilder
{
    public static async Task RebuildAsync(
        DiscWeaveDbContext context,
        IReadOnlyCollection<CollectionId> collectionIds,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(context);

        foreach (CollectionId collectionId in collectionIds.Distinct())
        {
            await RebuildAsync(context, collectionId, cancellationToken);
        }
    }

    public static async Task RebuildAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<SearchDocument> documents = Deduplicate(
            await SearchDocumentBuilder.BuildAsync(context, collectionId, cancellationToken));

        await using IDbContextTransaction? transaction = await BeginTransactionIfNeededAsync(context, cancellationToken);

        _ = await context.SearchDocuments
            .IgnoreQueryFilters()
            .Where(document => document.CollectionId == collectionId)
            .ExecuteDeleteAsync(cancellationToken);

        if (documents.Count > 0)
        {
            await context.SearchDocuments.AddRangeAsync(documents, cancellationToken);
            _ = await context.SaveChangesAsync(cancellationToken);
        }

        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }
    }

    private static async Task<IDbContextTransaction?> BeginTransactionIfNeededAsync(
        DiscWeaveDbContext context,
        CancellationToken cancellationToken)
    {
        return context.Database.CurrentTransaction is not null
            ? null
            : await context.Database.BeginTransactionAsync(cancellationToken);
    }

    private static IReadOnlyList<SearchDocument> Deduplicate(IReadOnlyList<SearchDocument> documents)
    {
        return
        [
            .. documents
                .GroupBy(
                    document => new
                    {
                        document.CollectionId,
                        document.EntityType,
                        document.EntityId
                    })
                .Select(group => group.First())
        ];
    }

}
