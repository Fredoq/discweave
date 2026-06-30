using DiscWeave.Api.Features.Releases;
using DiscWeave.Api.Features.Settings;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Exports;

public static partial class ExportsEndpointRouteBuilderExtensions
{
    private static async Task<IReadOnlyList<ImportPatternResponse>> LoadImportPatternsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        return
        [
            .. (await context.ImportPatterns.AsNoTracking()
                .Where(pattern => pattern.CollectionId == collectionId)
                .OrderBy(pattern => pattern.Kind)
                .ThenBy(pattern => pattern.SortOrder)
                .ThenBy(pattern => pattern.Template)
                .ToArrayAsync(cancellationToken))
                .Select(ToImportPatternResponse)
        ];
    }

    private static async Task<IReadOnlyList<NamingProfileResponse>> LoadNamingProfilesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        return
        [
            .. (await context.NamingProfiles.AsNoTracking()
                .Where(profile => profile.CollectionId == collectionId)
                .OrderBy(profile => profile.SortOrder)
                .ThenBy(profile => profile.Name)
                .ToArrayAsync(cancellationToken))
                .Select(ToNamingProfileResponse)
        ];
    }

    private static async Task<IReadOnlyList<ReleaseNamingOverrideResponse>> LoadReleaseNamingOverridesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        return
        [
            .. (await context.ReleaseNamingOverrides.AsNoTracking()
                .Where(overrideEntry => overrideEntry.CollectionId == collectionId)
                .OrderBy(overrideEntry => overrideEntry.ReleaseId)
                .ToArrayAsync(cancellationToken))
                .Select(ToReleaseNamingOverrideResponse)
        ];
    }

    private static async Task<IReadOnlyList<TagRoleMappingResponse>> LoadTagRoleMappingsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        return
        [
            .. (await context.TagRoleMappings.AsNoTracking()
                .Where(mapping => mapping.CollectionId == collectionId)
                .OrderBy(mapping => mapping.SortOrder)
                .ThenBy(mapping => mapping.CreditRoleCode)
                .ToArrayAsync(cancellationToken))
                .Select(ToTagRoleMappingResponse)
        ];
    }

    private static async Task<IReadOnlyList<TrackRelationParserRuleResponse>> LoadTrackRelationParserRulesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        return
        [
            .. (await context.TrackRelationParserRules.AsNoTracking()
                .Where(rule => rule.CollectionId == collectionId)
                .OrderBy(rule => rule.SortOrder)
                .ThenBy(rule => rule.RelationTypeCode)
                .ThenBy(rule => rule.Alias)
                .ToArrayAsync(cancellationToken))
                .Select(ToTrackRelationParserRuleResponse)
        ];
    }

    private static async Task<TrackStackSettingsResponse> LoadTrackStackSettingsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        return new TrackStackSettingsResponse(await TrackStackSettingsReader.GetDefaultRelationTypeCodesAsync(
            context,
            collectionId,
            cancellationToken));
    }
}
