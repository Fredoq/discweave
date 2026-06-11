using System.Text;
using DiscWeave.Application.Search;
using DiscWeave.Application.Security;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence.Search;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Persistence.Queries;

public sealed class CollectionSearchQueries : ICollectionSearchQueries
{
    private const decimal MinimumFuzzyMatchSimilarity = 0.18m;
    private readonly DiscWeaveDbContext _context;
    private readonly CollectionId _collectionId;

    public CollectionSearchQueries(DiscWeaveDbContext context, ICurrentCollection currentCollection)
    {
        _context = context;
        _collectionId = currentCollection.CollectionId;
    }

    public async Task<CollectionSearchResult> SearchAsync(CollectionSearchQuery query, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(query);

        string normalizedQuery = query.Query.Trim();
        string normalizedEntityType = query.EntityType?.Trim() ?? string.Empty;
        string roleFacet = NormalizeFacet(query.Role);
        string mediaFacet = NormalizeFacet(query.Media);
        string statusFacet = NormalizeFacet(query.Status);
        string tagFacet = NormalizeFacet(query.Tag);
        string labelFacet = query.LabelId.HasValue
            ? NormalizeFacet(query.LabelId.Value.ToString("D"))
            : string.Empty;
        string savedView = NormalizeFacet(query.SavedView);

        List<SearchDocument> documents = await _context.SearchDocuments
            .AsNoTracking()
            .Where(document => document.CollectionId == _collectionId)
            .Where(document => normalizedEntityType == string.Empty || document.EntityType == normalizedEntityType)
            .OrderBy(document => document.Title)
            .ThenBy(document => document.EntityType)
            .ThenBy(document => document.EntityId)
            .ToListAsync(cancellationToken);

        List<SearchResultReadModel> filtered = [.. documents
            .Where(document => MatchesFacet(document.RoleFacet, roleFacet))
            .Where(document => MatchesFacet(document.MediaFacet, mediaFacet))
            .Where(document => MatchesFacet(document.StatusFacet, statusFacet))
            .Where(document => MatchesFacet(document.TagFacet, tagFacet))
            .Where(document => MatchesLabel(document, query.LabelId, labelFacet))
            .Where(document => MatchesSavedView(document, savedView))
            .Where(document => MatchesQuery(document, normalizedQuery))
            .Select(document => ReadResult(document, Rank(document, normalizedQuery)))
            .OrderByDescending(result => result.Rank)
            .ThenBy(result => result.Title)
            .ThenBy(result => result.Type)
            .ThenBy(result => result.Id)];

        return new CollectionSearchResult(
            [.. filtered.Skip(query.Offset).Take(query.Limit)],
            query.Limit,
            query.Offset,
            filtered.Count);
    }

    private static SearchResultReadModel ReadResult(SearchDocument document, decimal rank)
    {
        var facets = new SearchResultFacetsReadModel(
            [.. SearchDocumentText.UnpackFacet(document.RoleFacet).Select(DisplayRole)],
            SearchDocumentText.UnpackFacet(document.MediaFacet),
            [.. SearchDocumentText.UnpackFacet(document.StatusFacet).Select(DisplayStatus)],
            SearchDocumentText.UnpackFacet(document.TagFacet),
            document.LabelId,
            [.. SearchDocumentText.UnpackFacet(document.CollectorSignalFacet).Select(DisplaySignal)]);

        return new SearchResultReadModel(
            document.EntityId,
            document.EntityType,
            document.Title,
            document.Subtitle,
            document.Summary,
            SearchDocumentText.Unpack(document.MatchedFields),
            SearchDocumentText.Unpack(document.Snippets),
            facets,
            rank);
    }

    private static bool MatchesFacet(string packedFacet, string normalizedFacet)
    {
        return normalizedFacet.Length == 0 || packedFacet.Contains($"|{normalizedFacet}|", StringComparison.Ordinal);
    }

    private static bool MatchesLabel(SearchDocument document, Guid? labelId, string normalizedLabelFacet)
    {
        return !labelId.HasValue || document.LabelId == labelId || MatchesFacet(document.LabelIdFacet, normalizedLabelFacet);
    }

    private static bool MatchesSavedView(SearchDocument document, string savedView)
    {
        return savedView switch
        {
            "" or "all" => true,
            "credits" => document.RoleFacet.Length > 0,
            "remixes" => document.EntityType == "track" && MatchesFacet(document.RoleFacet, "remixer"),
            "productions" => document.EntityType == "release" && MatchesFacet(document.RoleFacet, "producer"),
            "labels" => document.EntityType == "label",
            "needsdigitization" => MatchesFacet(document.StatusFacet, "needsdigitization"),
            "physicalwithoutdigital" => MatchesFacet(document.CollectorSignalFacet, "physicalwithoutdigital"),
            "lossywithoutlossless" or "mp3notlossless" => MatchesFacet(document.CollectorSignalFacet, "lossywithoutlossless"),
            "wantednotowned" => MatchesFacet(document.CollectorSignalFacet, "wantednotowned"),
            _ => false
        };
    }

    private static bool MatchesQuery(SearchDocument document, string query)
    {
        return query.Length == 0 ||
            IsDirectMatch(document, query) ||
            QuerySimilarity(document, query) >= MinimumFuzzyMatchSimilarity;
    }

    private static decimal Rank(SearchDocument document, string query)
    {
        if (query.Length == 0)
        {
            return 1m;
        }

        decimal rank = QuerySimilarity(document, query);
        if (IsDirectMatch(document, query))
        {
            rank += 1m;
        }

        if (string.Equals(document.Title, query, StringComparison.OrdinalIgnoreCase))
        {
            rank += 5m;
        }

        if (document.Title.Contains(query, StringComparison.OrdinalIgnoreCase))
        {
            rank += 2m;
        }

        return rank;
    }

    private static bool IsDirectMatch(SearchDocument document, string query)
    {
        return document.SearchText.Contains(query, StringComparison.OrdinalIgnoreCase);
    }

    private static decimal QuerySimilarity(SearchDocument document, string query)
    {
        decimal best = 0m;
        best = Math.Max(best, TrigramSimilarity(document.Title, query));
        best = Math.Max(best, TrigramSimilarity(document.Subtitle ?? string.Empty, query));
        best = Math.Max(best, TrigramSimilarity(document.Summary ?? string.Empty, query));
        best = Math.Max(best, TrigramSimilarity(document.SearchText, query));

        foreach (string token in SearchTokens(document.SearchText))
        {
            best = Math.Max(best, TrigramSimilarity(token, query));
        }

        return best;
    }

    private static decimal TrigramSimilarity(string value, string query)
    {
        HashSet<string> valueTrigrams = Trigrams(value);
        HashSet<string> queryTrigrams = Trigrams(query);
        if (valueTrigrams.Count == 0 || queryTrigrams.Count == 0)
        {
            return 0m;
        }

        int commonCount = valueTrigrams.Count(queryTrigrams.Contains);
        return commonCount / (decimal)Math.Max(valueTrigrams.Count, queryTrigrams.Count);
    }

    private static HashSet<string> Trigrams(string value)
    {
        string normalized = NormalizeSearchValue(value);
        if (normalized.Length == 0)
        {
            return [];
        }

        string padded = $"  {normalized} ";
        HashSet<string> trigrams = new(StringComparer.Ordinal);
        for (int index = 0; index <= padded.Length - 3; index++)
        {
            _ = trigrams.Add(padded.Substring(index, 3));
        }

        return trigrams;
    }

    private static string[] SearchTokens(string value)
    {
        return NormalizeSearchValue(value).Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }

    private static string NormalizeSearchValue(string value)
    {
        StringBuilder builder = new(value.Length);
        foreach (char character in value)
        {
            _ = builder.Append(char.IsLetterOrDigit(character) ? char.ToLowerInvariant(character) : ' ');
        }

        return string.Join(' ', builder.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
    }

    private static string NormalizeFacet(string? value)
    {
        return SearchDocumentText.NormalizeFacet(value ?? string.Empty);
    }

    private static string DisplayRole(string role)
    {
        return role switch
        {
            "mainartist" => "mainArtist",
            "featuredartist" => "featuredArtist",
            _ => role
        };
    }

    private static string DisplayStatus(string status)
    {
        return status == "needsdigitization" ? "needsDigitization" : status;
    }

    private static string DisplaySignal(string signal)
    {
        return signal switch
        {
            "physicalwithoutdigital" => "physicalWithoutDigital",
            "lossywithoutlossless" => "lossyWithoutLossless",
            "wantednotowned" => "wantedNotOwned",
            "needsdigitization" => "needsDigitization",
            _ => signal
        };
    }
}
