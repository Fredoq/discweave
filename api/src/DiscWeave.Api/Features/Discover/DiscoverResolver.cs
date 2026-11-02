using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Discover;

public sealed class DiscoverResolver
{
    private static readonly Uri AppleMusicSearch = new("https://music.apple.com/search", UriKind.Absolute);
    private readonly DiscWeaveDbContext _context;
    private readonly IExternalMetadataProviderResolver _providers;
    private readonly DiscoverHistoryStore _history;

    public DiscoverResolver(DiscWeaveDbContext context, IExternalMetadataProviderResolver providers, DiscoverHistoryStore history)
    {
        _context = context;
        _providers = providers;
        _history = history;
    }

    public async Task<ExternalMetadataResult<DiscoverResult>> ResolveAsync(DiscoverSnapshot snapshot, IReadOnlyList<DiscoverLead> leads, CancellationToken cancellationToken)
    {
        ExternalMetadataResult<IExternalMetadataProvider> provider = _providers.Resolve("discogs");
        if (!provider.IsSuccess)
        {
            return new ExternalMetadataResult<DiscoverResult>(provider.Error);
        }

        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(TimeSpan.FromSeconds(120));
        try
        {
            return await ResolveCoreAsync(snapshot, leads, provider.Value, deadline.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return new ExternalMetadataResult<DiscoverResult>(new ExternalMetadataError(
                ExternalMetadataErrorKind.Timeout, "discover.catalog_timeout", "Catalog verification timed out"));
        }
    }

    private async Task<ExternalMetadataResult<DiscoverResult>> ResolveCoreAsync(
        DiscoverSnapshot snapshot, IReadOnlyList<DiscoverLead> leads, IExternalMetadataProvider provider, CancellationToken cancellationToken)
    {
        DiscoverCatalogExclusions excluded = await LoadExclusionsAsync(snapshot.CollectionId, cancellationToken);
        HashSet<string> excludedKeys = excluded.Keys;
        HashSet<string> excludedTitles = excluded.Titles;
        var candidates = new List<ExternalMetadataReleaseDetail>();
        foreach (DiscoverLead lead in leads.DistinctBy(lead => DiscoverIdentity.TitleKey(lead.Title, [lead.Artist])).Take(20))
        {
            ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>> search =
                await provider.SearchReleasesAsync(new ExternalMetadataReleaseSearchQuery(Artist: lead.Artist, Title: lead.Title, Limit: 1), cancellationToken);
            if (!search.IsSuccess)
            {
                return new ExternalMetadataResult<DiscoverResult>(search.Error);
            }

            ExternalMetadataReleaseCandidate? candidate = CandidateForLookup(search.Value.Items, excludedKeys);
            if (candidate is null)
            {
                continue;
            }

            ExternalMetadataResult<ExternalMetadataReleaseDetail> detail = await provider.GetReleaseAsync(new ExternalMetadataLookupQuery(candidate.Source.ExternalId), cancellationToken);
            if (!detail.IsSuccess)
            {
                return new ExternalMetadataResult<DiscoverResult>(detail.Error);
            }

            if (candidate.Source.ExternalId == detail.Value.Source.ExternalId && Eligible(lead, detail.Value, excludedKeys, excludedTitles))
            {
                candidates.Add(detail.Value);
                excludedKeys.UnionWith(DiscoverIdentity.Keys(detail.Value));
                _ = excludedTitles.Add(DiscoverIdentity.TitleKey(detail.Value.Title, detail.Value.Artists));
            }
        }

        // Catalog writes can happen while provider calls are in progress.
        DiscoverCatalogExclusions current = await LoadExclusionsAsync(snapshot.CollectionId, cancellationToken);
        ExternalMetadataReleaseDetail[] chosen = Choose(candidates.Where(candidate =>
            !DiscoverIdentity.Keys(candidate).Any(current.Keys.Contains) &&
            (DiscoverIdentity.HasRecordingVariant(candidate) || !current.Titles.Contains(DiscoverIdentity.TitleKey(candidate.Title, candidate.Artists)))), snapshot);
        DiscoverRelease[] items = [.. chosen.Select(release => ToResponse(release, snapshot))];
        // Failed or cancelled generations never advance visible-history state.
        _ = await _history.RecordAsync(snapshot.CollectionId,
            [.. chosen.Select(release => _history.Shown(release.Source.ExternalId, DiscoverIdentity.Keys(release), release.Artists[0], release.Title))], false, cancellationToken);
        return new ExternalMetadataResult<DiscoverResult>(new DiscoverResult(items,
            items.Length == 10 ? "10 verified releases outside your catalog" : $"Found {items.Length} verified releases outside your catalog; no unverified suggestions were added"));
    }

    private static ExternalMetadataReleaseCandidate? CandidateForLookup(
        IReadOnlyList<ExternalMetadataReleaseCandidate> candidates, HashSet<string> excludedKeys)
    {
        ExternalMetadataReleaseCandidate? candidate = candidates.Count > 0 ? candidates[0] : null;
        return candidate is null || !DiscoverIdentity.IsDiscogsRelease(candidate.Source) || excludedKeys.Contains("release:" + candidate.Source.ExternalId)
            ? null : candidate;
    }

    public static bool Eligible(DiscoverLead lead, ExternalMetadataReleaseDetail release, ISet<string> excludedKeys, ISet<string> excludedTitles)
    {
        return DiscoverIdentity.Matches(lead, release) && !DiscoverIdentity.Keys(release).Any(excludedKeys.Contains) &&
            (DiscoverIdentity.HasRecordingVariant(release) || !excludedTitles.Contains(DiscoverIdentity.TitleKey(release.Title, release.Artists)));
    }

    public static ExternalMetadataReleaseDetail[] Choose(IEnumerable<ExternalMetadataReleaseDetail> candidates, DiscoverSnapshot snapshot)
    {
        var artistCounts = new Dictionary<string, int>(StringComparer.Ordinal);
        var chosen = new List<ExternalMetadataReleaseDetail>();
        foreach (ExternalMetadataReleaseDetail candidate in candidates.OrderByDescending(release =>
                     snapshot.Mode == "adventurous" ? -Math.Abs(ArtistScore(release, snapshot.Examples)) : ArtistScore(release, snapshot.Examples)))
        {
            string artist = DiscoverIdentity.Normalize(candidate.Artists[0]);
            int count = artistCounts.GetValueOrDefault(artist);
            if (count >= 2 || ArtistScore(candidate, snapshot.Examples) < 0)
            {
                continue;
            }

            chosen.Add(candidate);
            artistCounts[artist] = count + 1;
            if (chosen.Count == 10)
            {
                break;
            }
        }

        return [.. chosen];
    }

    private static int ArtistScore(ExternalMetadataReleaseDetail release, IReadOnlyList<DiscoverExample> examples)
    {
        return examples.Where(example => release.Artists.Any(artist => DiscoverIdentity.Normalize(artist) == DiscoverIdentity.Normalize(example.Artist)))
            .Sum(example => example.Rating - 3 + (example.Standout ? 1 : 0));
    }

    private static DiscoverRelease ToResponse(ExternalMetadataReleaseDetail release, DiscoverSnapshot snapshot)
    {
        var appleMusicSearch = new UriBuilder(AppleMusicSearch)
        {
            Query = "term=" + Uri.EscapeDataString(string.Join(" ", release.Artists) + " " + release.Title)
        };
        return new DiscoverRelease(release.Source.ExternalId, release.Title, release.Artists, release.Year, release.Labels,
            release.Genres, release.Formats, release.Source.SourceUrl, release.Source.Attribution, RecommendationReason(release, snapshot),
            appleMusicSearch.Uri.AbsoluteUri);
    }

    private static string RecommendationReason(ExternalMetadataReleaseDetail release, DiscoverSnapshot snapshot)
    {
        string exploratoryReason = snapshot.Context is not null
            ? "An exploratory suggestion from your selected item's metadata; release identity verified on Discogs, not an audio comparison"
            : "An exploratory suggestion from your rated metadata; release identity verified on Discogs, not an audio comparison";
        return ArtistScore(release, snapshot.Examples) > 0
            ? "An artist with positive Overall ratings in your collection; release identity verified on Discogs"
            : exploratoryReason;
    }

    private async Task<DiscoverCatalogExclusions> LoadExclusionsAsync(CollectionId collectionId, CancellationToken cancellationToken)
    {
        Release[] releases = await _context.Releases.AsNoTracking().Include("_externalSources").Include(release => release.Tracklist)
            .Where(release => release.CollectionId == collectionId).ToArrayAsync(cancellationToken);
        Credit[] credits = await _context.Credits.AsNoTracking()
            .Where(credit => credit.CollectionId == collectionId).ToArrayAsync(cancellationToken);
        Dictionary<TrackId, string> trackTitles = await _context.Tracks.AsNoTracking()
            .Where(track => track.CollectionId == collectionId).ToDictionaryAsync(track => track.Id, track => track.Title, cancellationToken);
        HashSet<string> keys = LocalKeys(releases, trackTitles);
        DiscoverHistoryEntry[] history = await _history.ReadAsync(collectionId, cancellationToken);
        keys.UnionWith(history.SelectMany(entry => entry.Keys));
        return new DiscoverCatalogExclusions(keys, LocalTitles(releases, credits));
    }

    public static HashSet<string> LocalKeys(IEnumerable<Release> releases, IReadOnlyDictionary<TrackId, string> trackTitles)
    {
        var keys = new HashSet<string>(StringComparer.Ordinal);
        foreach (Release release in releases)
        {
            string[] titles = [.. release.Tracklist.Select(row => LocalTrackTitle(row, trackTitles))];
            bool reliableRows = titles.Length > 0 && titles.All(title => !string.IsNullOrWhiteSpace(title));
            foreach (ExternalSourceReference source in release.ExternalSources.Where(source => source.ProviderName == "discogs"))
            {
                if (source.ResourceType == "release")
                {
                    _ = keys.Add("release:" + source.ExternalId);
                }
                else if (source.ResourceType == "master" && reliableRows)
                {
                    _ = keys.Add(DiscoverIdentity.MasterKey(source.ExternalId, release.DisplayName, titles));
                }
            }
        }

        return keys;
    }

    private static string LocalTrackTitle(ReleaseTrack row, IReadOnlyDictionary<TrackId, string> trackTitles)
    {
        string linkedTitle = row.TrackId is { } id ? trackTitles.GetValueOrDefault(id, string.Empty) : string.Empty;
        return row.TitleOverride is PresentOptionalValue<string> present ? present.Value : linkedTitle;
    }

    private static HashSet<string> LocalTitles(IEnumerable<Release> releases, Credit[] credits)
    {
        return releases.Select(release => DiscoverIdentity.TitleKey(release.DisplayName,
            credits.Where(credit => credit.Target is ReleaseCreditTarget target && target.ReleaseId == release.Id && credit.Roles.Contains("mainArtist"))
                .Select(credit => credit.Contributor.Name))).ToHashSet(StringComparer.Ordinal);
    }
}
