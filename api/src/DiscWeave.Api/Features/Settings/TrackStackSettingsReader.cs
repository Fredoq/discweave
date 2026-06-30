using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Settings;

internal static class TrackStackSettingsReader
{
    public static async Task<IReadOnlyList<string>> GetDefaultRelationTypeCodesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        TrackStackSettings? settings = await context.TrackStackSettings.AsNoTracking()
            .SingleOrDefaultAsync(item => item.CollectionId == collectionId, cancellationToken);

        return settings is null
            ? await GetStarterRelationTypeCodesAsync(context, collectionId, cancellationToken)
            : settings.DefaultRelationTypeCodes;
    }

    private static async Task<IReadOnlyList<string>> GetStarterRelationTypeCodesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        string[] defaultCodes = [.. CollectionDictionaryDefaults.DefaultTrackStackRelationTypeCodes];
        string[] activeCodes = await context.CollectionDictionaryEntries.AsNoTracking()
            .Where(entry => entry.CollectionId == collectionId &&
                entry.Kind == DictionaryKind.TrackRelationType &&
                entry.IsActive &&
                defaultCodes.Contains(entry.Code))
            .OrderBy(entry => entry.SortOrder)
            .Select(entry => entry.Code)
            .ToArrayAsync(cancellationToken);

        return activeCodes;
    }
}
