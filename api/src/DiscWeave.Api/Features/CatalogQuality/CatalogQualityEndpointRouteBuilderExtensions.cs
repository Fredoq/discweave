using DiscWeave.Api.Auth;
using DiscWeave.Api.Http;
using DiscWeave.Api.Features.ReviewWorkbench;
using DiscWeave.Application.Security;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.CatalogQuality;

public static partial class CatalogQualityEndpointRouteBuilderExtensions
{
    private const int DefaultLimit = 25;
    private const int MaxLimit = 100;

    public static IEndpointRouteBuilder MapCatalogQualityEndpoints(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        RouteGroupBuilder group = endpoints.MapGroup("/api/catalog-quality")
            .WithTags("Catalog Quality")
            .RequireAuthorization(DiscWeaveAuthorizationPolicies.CollectionMember);

        _ = group.MapGet("", GetCatalogQualityAsync).WithName("GetCatalogQuality");

        return endpoints;
    }

    private static async Task<IResult> GetCatalogQualityAsync(
        int? limit,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        if (!TryNormalizeLimit(limit, out int normalizedLimit))
        {
            return EndpointErrors.BadRequest("catalog_quality.limit_invalid", "Catalog quality limit must be between 1 and 100");
        }

        IReadOnlyList<ReviewWorkbenchSignal> signals = await ReviewWorkbenchSignalBuilder.BuildAsync(
            context,
            currentCollection.CollectionId,
            cancellationToken);

        var response = new CatalogQualityResponse(
            normalizedLimit,
            new CatalogQualityResponse.DuplicateCandidateReport(
                DuplicateGroupSection(signals, ReviewWorkbenchSubtypes.DuplicateReleases, normalizedLimit),
                DuplicateGroupSection(signals, ReviewWorkbenchSubtypes.DuplicateTracks, normalizedLimit),
                DuplicateGroupSection(signals, ReviewWorkbenchSubtypes.DuplicateDigitalFileIdentities, normalizedLimit)),
            new CatalogQualityResponse.MissingMetadataReport(
                SampleSection(signals, ReviewWorkbenchSubtypes.ReleasesMissingYearOrDate, normalizedLimit),
                SampleSection(signals, ReviewWorkbenchSubtypes.ReleasesMissingLabel, normalizedLimit),
                SampleSection(signals, ReviewWorkbenchSubtypes.TracksMissingDuration, normalizedLimit),
                SampleSection(signals, ReviewWorkbenchSubtypes.OwnedItemsMissingCondition, normalizedLimit),
                SampleSection(signals, ReviewWorkbenchSubtypes.OwnedItemsMissingStorageLocation, normalizedLimit),
                SampleSection(signals, ReviewWorkbenchSubtypes.OwnedItemsMissingDigitalFormat, normalizedLimit)),
            new CatalogQualityResponse.FormatGapReport(
                SampleSection(signals, ReviewWorkbenchSubtypes.PhysicalWithoutDigital, normalizedLimit),
                SampleSection(signals, ReviewWorkbenchSubtypes.LossyWithoutLossless, normalizedLimit),
                SampleSection(signals, ReviewWorkbenchSubtypes.WantedNotOwned, normalizedLimit),
                SampleSection(signals, ReviewWorkbenchSubtypes.NeedsDigitization, normalizedLimit)));

        return Results.Ok(response);
    }

    private static bool TryNormalizeLimit(int? requestedLimit, out int limit)
    {
        limit = requestedLimit ?? DefaultLimit;
        return limit is >= 1 and <= MaxLimit;
    }

    private static CatalogQualityResponse.Section<CatalogQualityResponse.DuplicateGroup> DuplicateGroupSection(
        IEnumerable<ReviewWorkbenchSignal> signals,
        string subtype,
        int limit)
    {
        CatalogQualityResponse.DuplicateGroup[] groups = [.. signals
            .Where(signal => signal.Subtype == subtype)
            .Select(group => new CatalogQualityResponse.DuplicateGroup(
                group.ComparisonKey ?? group.Title,
                group.Targets.Count,
                [.. group.Targets.Select(target => target.Id).Order()]))
            .OrderBy(group => group.Key, StringComparer.OrdinalIgnoreCase)];

        return new CatalogQualityResponse.Section<CatalogQualityResponse.DuplicateGroup>(
            groups.Length,
            [.. groups.Take(limit)]);
    }

    private static CatalogQualityResponse.Section<CatalogQualityResponse.Sample> SampleSection(
        IEnumerable<ReviewWorkbenchSignal> signals,
        string subtype,
        int limit)
    {
        CatalogQualityResponse.Sample[] samples = [.. signals
            .Where(signal => signal.Subtype == subtype)
            .Select(signal => signal.Targets[0])
            .Select(target => new CatalogQualityResponse.Sample(target.Id, target.Title, CatalogQualityTargetType(target)))
            .OrderBy(sample => sample.Title, StringComparer.OrdinalIgnoreCase)
            .ThenBy(sample => sample.Id)];

        return new CatalogQualityResponse.Section<CatalogQualityResponse.Sample>(
            samples.Length,
            [.. samples.Take(limit)]);
    }

    private static string? CatalogQualityTargetType(ReviewWorkbenchSignalTarget target)
    {
        return target.Kind == ReviewWorkbenchTargetKinds.OwnedItem
            ? target.CatalogTargetKind
            : target.Kind;
    }
}
