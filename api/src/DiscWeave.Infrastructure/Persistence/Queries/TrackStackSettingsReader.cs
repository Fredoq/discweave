using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Persistence.Queries;

public static class TrackStackSettingsReader
{
    public static async Task<IReadOnlyList<string>>
        GetDefaultRelationTypeCodesAsync(
            DiscWeaveDbContext context,
            CollectionId collectionId,
            CancellationToken cancellationToken)
    {
        TrackStackSettings? settings = await context.TrackStackSettings
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item => item.CollectionId == collectionId,
                cancellationToken);
        if (settings is not null)
        {
            return settings.DefaultRelationTypeCodes;
        }

        string[] defaultCodes =
        [
            .. CollectionDictionaryDefaults.DefaultTrackStackRelationTypeCodes
        ];
        return await context.CollectionDictionaryEntries
            .AsNoTracking()
            .Where(entry =>
                entry.CollectionId == collectionId
                && entry.Kind == DictionaryKind.TrackRelationType
                && entry.IsActive
                && defaultCodes.Contains(entry.Code))
            .OrderBy(entry => entry.SortOrder)
            .ThenBy(entry => entry.Code)
            .Select(entry => entry.Code)
            .ToArrayAsync(cancellationToken);
    }
}
