using System.Text;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Labels;

public static class LabelDiscogsCatalogMatcher
{
    public static async Task<LabelDiscogsCatalogItemResponse[]> MatchAsync(
        DiscWeaveDbContext context, CollectionId collectionId, LabelId labelId,
        IReadOnlyList<DiscogsLabelCatalogItem> items, CancellationToken cancellationToken)
    {
        Release[] releases = await context.Releases.AsNoTracking().Include("_externalSources").Include(release => release.Labels)
            .Where(release => release.CollectionId == collectionId).ToArrayAsync(cancellationToken);
        Credit[] credits = await context.Credits.AsNoTracking().Where(credit => credit.CollectionId == collectionId).ToArrayAsync(cancellationToken);
        OwnedItem[] holdings = await context.OwnedItems.AsNoTracking().Where(item => item.CollectionId == collectionId).ToArrayAsync(cancellationToken);
        return Match(labelId, items, releases, credits, holdings);
    }

    public static LabelDiscogsCatalogItemResponse[] Match(LabelId labelId, IReadOnlyList<DiscogsLabelCatalogItem> items,
        IReadOnlyList<Release> releases, IReadOnlyList<Credit> credits, IReadOnlyList<OwnedItem> holdings)
    {
        ILookup<ReleaseId, string> artists = credits.Where(credit => credit.Target is ReleaseCreditTarget && credit.Roles.Contains("mainArtist"))
            .ToLookup(credit => ((ReleaseCreditTarget)credit.Target).ReleaseId, credit => credit.Contributor.Name);
        ILookup<ReleaseId, OwnershipStatus> statuses = holdings.ToLookup(item => item.ReleaseId, item => item.Holding.Status);
        return [.. items.Select(item => Map(item, labelId, releases, artists, statuses))];
    }

    private static LabelDiscogsCatalogItemResponse Map(DiscogsLabelCatalogItem item, LabelId labelId, IReadOnlyList<Release> releases,
        ILookup<ReleaseId, string> artists, ILookup<ReleaseId, OwnershipStatus> statuses)
    {
        Release[] exact = [.. releases.Where(release => release.ExternalSources.Any(source =>
            source.ProviderName == "discogs" && source.ResourceType == "release" && source.ExternalId == item.ExternalId))];
        Release[] matches = exact.Length > 0 ? exact : [.. releases.Where(release => IsPossible(item, release, labelId, artists[release.Id]))];
        string kind = (exact.Length > 0, matches.Length > 0) switch
        {
            (true, _) => "exact",
            (_, true) => "possible",
            _ => "unmatched"
        };
        return new LabelDiscogsCatalogItemResponse(item.ExternalId, item.CatalogNumber, item.Artist, item.Title, item.Year, item.Format,
            kind, [.. matches.OrderBy(release => release.Id.Value).Select(release => new LabelDiscogsCatalogMatch(
                release.Id.Value, release.Summary.Title, statuses[release.Id].Any(status => status is OwnershipStatus.Owned or OwnershipStatus.NeedsDigitization),
                statuses[release.Id].Contains(OwnershipStatus.Wanted)))]);
    }

    private static bool IsPossible(DiscogsLabelCatalogItem item, Release release, LabelId labelId, IEnumerable<string> artists)
    {
        string catalogKey = CatalogKey(item.CatalogNumber);
        return catalogKey.Length > 0 && Normalize(item.Title).Length > 0 && Normalize(item.Artist).Length > 0 &&
            Normalize(release.Summary.Title) == Normalize(item.Title) && (release.IsVariousArtists ? Normalize(item.Artist) == "VARIOUS" :
                artists.Any(artist => Normalize(DiscogsArtistNameCleaner.Clean(artist)) == Normalize(DiscogsArtistNameCleaner.Clean(item.Artist)))) &&
            release.Labels.Any(label => label.LabelId == labelId && !label.HasNoCatalogNumber &&
                label.CatalogNumber.Match(value => CatalogKey(value) == catalogKey, static () => false));
    }

    public static string CatalogKey(string value)
    {
        string key = Normalize(value);
        return key == "NONE" ? string.Empty : key;
    }

    private static string Normalize(string value)
    {
        return string.Concat(value.Normalize(NormalizationForm.FormKC).Where(char.IsLetterOrDigit)).ToUpperInvariant();
    }
}
