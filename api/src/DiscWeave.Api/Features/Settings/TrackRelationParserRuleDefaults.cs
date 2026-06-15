using DiscWeave.Application.Errors;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Settings;

internal static class TrackRelationParserRuleDefaults
{
    public static async Task EnsureAsync(DiscWeaveDbContext context, CollectionId collectionId, CancellationToken cancellationToken)
    {
        TrackRelationParserRule[] defaults = [.. CollectionDictionaryDefaults.CreateTrackRelationParserRules(collectionId)];
        TrackRelationParserRule[] existingRules = await context.TrackRelationParserRules
            .Where(rule => rule.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);
        HashSet<string> activeRelationTypeCodes = await context.CollectionDictionaryEntries.AsNoTracking()
            .Where(entry => entry.CollectionId == collectionId &&
                entry.Kind == DictionaryKind.TrackRelationType &&
                entry.IsActive)
            .Select(entry => entry.Code)
            .ToHashSetAsync(StringComparer.Ordinal, cancellationToken);
        HashSet<RuleKey> existingKeys = [.. existingRules
            .Select(rule => new RuleKey(rule.RelationTypeCode, rule.Alias, rule.MatchMode))];

        foreach (TrackRelationParserRule defaultRule in defaults)
        {
            var key = new RuleKey(defaultRule.RelationTypeCode, defaultRule.Alias, defaultRule.MatchMode);
            if (existingKeys.Contains(key) || !activeRelationTypeCodes.Contains(defaultRule.RelationTypeCode))
            {
                continue;
            }

            _ = context.TrackRelationParserRules.Add(defaultRule);
            _ = existingKeys.Add(key);
        }

        await SaveSeedChangesAsync(context, collectionId, cancellationToken);
    }

    private static async Task SaveSeedChangesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        try
        {
            _ = await context.SaveChangesAsync(cancellationToken);
        }
        catch (ResourceConflictException)
        {
            context.ChangeTracker.Clear();
            bool hasBuiltin = await context.TrackRelationParserRules.AsNoTracking()
                .AnyAsync(rule => rule.CollectionId == collectionId && rule.IsBuiltin, cancellationToken);
            if (!hasBuiltin)
            {
                throw;
            }
        }
    }

    private readonly record struct RuleKey(
        string RelationTypeCode,
        string Alias,
        TrackRelationParserRuleMatchMode MatchMode);
}
