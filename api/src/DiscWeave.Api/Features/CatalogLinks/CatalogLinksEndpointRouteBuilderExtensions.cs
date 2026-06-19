using DiscWeave.Api.Auth;
using DiscWeave.Api.Http;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.CatalogLinks;

public static class CatalogLinksEndpointRouteBuilderExtensions
{
    private const string ArtistKind = "artist";
    private const string LabelKind = "label";
    private const string OwnedItemKind = "ownedItem";
    private const string PlaylistKind = "playlist";
    private const string ReleaseKind = "release";
    private const string TrackKind = "track";
    private const string MediumTypeShadowName = "_mediumType";
    private const string StatusShadowName = "_status";
    private const string ReleaseIdShadowName = "_releaseId";

    private static readonly string[] DefaultKinds = [ArtistKind, ReleaseKind, TrackKind, OwnedItemKind, LabelKind, PlaylistKind];

    public static IEndpointRouteBuilder MapCatalogLinksEndpoints(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        RouteGroupBuilder group = endpoints.MapGroup("/api/catalog-links")
            .WithTags("Catalog Links")
            .RequireAuthorization(DiscWeaveAuthorizationPolicies.CollectionMember);
        _ = group.MapGet("", ListCatalogLinksAsync).WithName("ListCatalogLinks");

        return endpoints;
    }

    private static async Task<IResult> ListCatalogLinksAsync(
        string? query,
        string? kinds,
        int? limit,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        if (!Pagination.TryNormalize(limit, 0, out int normalizedLimit, out _, out IResult error))
        {
            return error;
        }

        string[] requestedKinds = ParseKinds(kinds);
        string? normalizedQuery = string.IsNullOrWhiteSpace(query) ? null : query.Trim();
        string? pattern = string.IsNullOrWhiteSpace(query) ? null : $"%{query.Trim()}%";
        List<CatalogLinkResponse> items =
        [
            .. await ArtistLinksAsync(context, currentCollection.CollectionId, requestedKinds, pattern, normalizedLimit, cancellationToken),
            .. await LabelLinksAsync(context, currentCollection.CollectionId, requestedKinds, pattern, normalizedLimit, cancellationToken),
            .. await ReleaseLinksAsync(context, currentCollection.CollectionId, requestedKinds, pattern, normalizedLimit, cancellationToken),
            .. await TrackLinksAsync(context, currentCollection.CollectionId, requestedKinds, pattern, normalizedLimit, cancellationToken),
            .. await OwnedItemLinksAsync(context, currentCollection.CollectionId, requestedKinds, normalizedQuery, pattern, normalizedLimit, cancellationToken),
            .. await PlaylistLinksAsync(context, currentCollection.CollectionId, requestedKinds, pattern, normalizedLimit, cancellationToken)
        ];

        CatalogLinkResponse[] page = [.. items.OrderBy(item => item.Title).ThenBy(item => item.Kind).ThenBy(item => item.Id).Take(normalizedLimit)];
        return Results.Ok(new CatalogLinksResponse(page));
    }

    private static string[] ParseKinds(string? kinds)
    {
        return string.IsNullOrWhiteSpace(kinds)
            ? DefaultKinds
            : [.. kinds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)];
    }

    private static async Task<IReadOnlyList<CatalogLinkResponse>> ArtistLinksAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        string[] requestedKinds,
        string? pattern,
        int limit,
        CancellationToken cancellationToken)
    {
        return KindRequested(requestedKinds, ArtistKind)
            ? await context.Artists.AsNoTracking()
                .Where(item => item.CollectionId == collectionId && (pattern == null || EF.Functions.Like(item.Name, pattern)))
                .OrderBy(item => item.Name)
                .Take(limit)
                .Select(item => new CatalogLinkResponse(ArtistKind, item.Id.Value, item.Name, ArtistKind))
                .ToArrayAsync(cancellationToken)
            : [];
    }

    private static async Task<IReadOnlyList<CatalogLinkResponse>> LabelLinksAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        string[] requestedKinds,
        string? pattern,
        int limit,
        CancellationToken cancellationToken)
    {
        return KindRequested(requestedKinds, LabelKind)
            ? await context.Labels.AsNoTracking()
                .Where(item => item.CollectionId == collectionId && (pattern == null || EF.Functions.Like(item.Name, pattern)))
                .OrderBy(item => item.Name)
                .Take(limit)
                .Select(item => new CatalogLinkResponse(LabelKind, item.Id.Value, item.Name, LabelKind))
                .ToArrayAsync(cancellationToken)
            : [];
    }

    private static async Task<IReadOnlyList<CatalogLinkResponse>> ReleaseLinksAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        string[] requestedKinds,
        string? pattern,
        int limit,
        CancellationToken cancellationToken)
    {
        return KindRequested(requestedKinds, ReleaseKind)
            ? await context.Releases.AsNoTracking()
                .Where(item => item.CollectionId == collectionId && (pattern == null || EF.Functions.Like(item.Summary.Title, pattern)))
                .OrderBy(item => item.Summary.Title)
                .Take(limit)
                .Select(item => new CatalogLinkResponse(ReleaseKind, item.Id.Value, item.Summary.Title, item.Summary.Metadata.Type))
                .ToArrayAsync(cancellationToken)
            : [];
    }

    private static async Task<IReadOnlyList<CatalogLinkResponse>> TrackLinksAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        string[] requestedKinds,
        string? pattern,
        int limit,
        CancellationToken cancellationToken)
    {
        return KindRequested(requestedKinds, TrackKind)
            ? await context.Tracks.AsNoTracking()
                .Where(item => item.CollectionId == collectionId && (pattern == null || EF.Functions.Like(item.Title, pattern)))
                .OrderBy(item => item.Title)
                .Take(limit)
                .Select(item => new CatalogLinkResponse(TrackKind, item.Id.Value, item.Title, TrackKind))
                .ToArrayAsync(cancellationToken)
            : [];
    }

    private static async Task<IReadOnlyList<CatalogLinkResponse>> OwnedItemLinksAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        string[] requestedKinds,
        string? query,
        string? pattern,
        int limit,
        CancellationToken cancellationToken)
    {
        if (!KindRequested(requestedKinds, OwnedItemKind))
        {
            return [];
        }

        IQueryable<OwnedItem> ownedItemQuery = context.OwnedItems.AsNoTracking()
            .Where(item => item.CollectionId == collectionId);
        if (query is not null && pattern is not null)
        {
            ownedItemQuery = ApplyOwnedItemQueryFilter(context, collectionId, ownedItemQuery, query, pattern);
        }

        OwnedItem[] ownedItems = await ownedItemQuery
            .OrderBy(item => item.Id)
            .Take(limit)
            .ToArrayAsync(cancellationToken);
        ReleaseId[] releaseIds = [.. ownedItems.Select(item => item.ReleaseId).Distinct()];
        Dictionary<ReleaseId, Release> releases = releaseIds.Length == 0
            ? []
            : await context.Releases.AsNoTracking()
                .Where(release => release.CollectionId == collectionId && releaseIds.Contains(release.Id))
                .ToDictionaryAsync(release => release.Id, cancellationToken);

        return [.. ownedItems.Select(item => OwnedItemLink(item, releases))];
    }

    private static async Task<IReadOnlyList<CatalogLinkResponse>> PlaylistLinksAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        string[] requestedKinds,
        string? pattern,
        int limit,
        CancellationToken cancellationToken)
    {
        return KindRequested(requestedKinds, PlaylistKind)
            ? await context.Playlists.AsNoTracking()
                .Where(item => item.CollectionId == collectionId && (pattern == null || EF.Functions.Like(item.Name, pattern)))
                .OrderBy(item => item.Name)
                .Take(limit)
                .Select(item => new CatalogLinkResponse(PlaylistKind, item.Id.Value, item.Name, PlaylistKind))
                .ToArrayAsync(cancellationToken)
            : [];
    }

    private static bool KindRequested(string[] requestedKinds, string kind)
    {
        return requestedKinds.Contains(kind, StringComparer.OrdinalIgnoreCase);
    }

    private static IQueryable<OwnedItem> ApplyOwnedItemQueryFilter(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IQueryable<OwnedItem> query,
        string text,
        string pattern)
    {
        OwnershipStatus[] matchingStatuses = MatchingOwnershipStatuses(text);
        IQueryable<Release> matchingReleases = context.Releases.AsNoTracking()
            .Where(release => release.CollectionId == collectionId && EF.Functions.Like(release.Summary.Title, pattern));
        IQueryable<Track> matchingTracks = context.Tracks.AsNoTracking()
            .Where(track => track.CollectionId == collectionId && EF.Functions.Like(track.Title, pattern));
        IQueryable<Release> matchingTrackReleases = context.Releases.AsNoTracking()
            .Where(release =>
                release.CollectionId == collectionId &&
                release.Tracklist.Any(releaseTrack => matchingTracks.Any(track => track.Id == releaseTrack.TrackId)));

        return matchingStatuses.Length == 0
            ? query.Where(item =>
                matchingReleases.Any(release => EF.Property<ReleaseId>(item, ReleaseIdShadowName) == release.Id) ||
                matchingTrackReleases.Any(release => EF.Property<ReleaseId>(item, ReleaseIdShadowName) == release.Id) ||
                EF.Functions.Like(EF.Property<string>(item, MediumTypeShadowName), pattern))
            : query.Where(item =>
                matchingReleases.Any(release => EF.Property<ReleaseId>(item, ReleaseIdShadowName) == release.Id) ||
                matchingTrackReleases.Any(release => EF.Property<ReleaseId>(item, ReleaseIdShadowName) == release.Id) ||
                EF.Functions.Like(EF.Property<string>(item, MediumTypeShadowName), pattern) ||
                matchingStatuses.Contains(EF.Property<OwnershipStatus>(item, StatusShadowName)));
    }

    private static OwnershipStatus[] MatchingOwnershipStatuses(string query)
    {
        return
        [
            .. new[] { OwnershipStatus.Owned, OwnershipStatus.Wanted, OwnershipStatus.Sold, OwnershipStatus.NeedsDigitization }
                .Where(status => OwnershipStatusCode(status).Contains(query, StringComparison.OrdinalIgnoreCase))
        ];
    }

    private static CatalogLinkResponse OwnedItemLink(
        OwnedItem item,
        Dictionary<ReleaseId, Release> releases)
    {
        string title = releases.TryGetValue(item.ReleaseId, out Release? release) ? release.Summary.Title : "Unknown release";

        string subtitle = $"{item.Holding.Medium.Code} / {OwnershipStatusCode(item.Holding.Status)}";
        return new CatalogLinkResponse(OwnedItemKind, item.Id.Value, title, subtitle);
    }

    private static string OwnershipStatusCode(OwnershipStatus status)
    {
        return status switch
        {
            OwnershipStatus.Owned => "owned",
            OwnershipStatus.Wanted => "wanted",
            OwnershipStatus.Sold => "sold",
            OwnershipStatus.NeedsDigitization => "needsDigitization",
            _ => throw new InvalidOperationException("Ownership status is not supported")
        };
    }

    private sealed record CatalogLinksResponse(IReadOnlyList<CatalogLinkResponse> Items);

    private sealed record CatalogLinkResponse(string Kind, Guid Id, string Title, string? Subtitle);
}
