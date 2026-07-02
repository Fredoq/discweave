using System.Text;
using DiscWeave.Application.Search;
using DiscWeave.Application.Security;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence.Search;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Persistence.Queries;

public sealed partial class CollectionSearchQueries : ICollectionSearchQueries
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

        IQueryable<SearchDocument> documentsQuery = _context.SearchDocuments
            .AsNoTracking()
            .Where(document => document.CollectionId == _collectionId)
            .Where(document => normalizedEntityType == string.Empty || document.EntityType == normalizedEntityType);

        documentsQuery = ApplyFacetFilter(documentsQuery, document => document.RoleFacet, roleFacet);
        documentsQuery = ApplyFacetFilter(documentsQuery, document => document.MediaFacet, mediaFacet);
        documentsQuery = ApplyFacetFilter(documentsQuery, document => document.StatusFacet, statusFacet);
        documentsQuery = ApplyFacetFilter(documentsQuery, document => document.TagFacet, tagFacet);
        documentsQuery = ApplyLabelFilter(documentsQuery, query.LabelId, labelFacet);
        documentsQuery = ApplySavedViewFilter(documentsQuery, savedView);

        if (normalizedQuery.Length == 0)
        {
            int total = await documentsQuery.CountAsync(cancellationToken);
            List<SearchDocument> page = await documentsQuery
                .OrderBy(document => document.Title)
                .ThenBy(document => document.EntityType)
                .ThenBy(document => document.EntityId)
                .Skip(query.Offset)
                .Take(query.Limit)
                .ToListAsync(cancellationToken);
            Dictionary<Guid, string> identityHints = await LoadArtistIdentityHintsAsync(page, cancellationToken);

            return new CollectionSearchResult(
                [.. page.Select(document => ReadResult(document, 1m, identityHints))],
                query.Limit,
                query.Offset,
                total);
        }

        HashSet<string> queryTrigrams = Trigrams(normalizedQuery);
        string[] candidateTerms = CandidateTerms(normalizedQuery);
        if (candidateTerms.Length == 0)
        {
            return new CollectionSearchResult([], query.Limit, query.Offset, 0);
        }

        documentsQuery = ApplyQueryCandidateFilter(documentsQuery, candidateTerms);
        List<SearchDocument> documents = await documentsQuery.ToListAsync(cancellationToken);
        List<DocumentScore> scored = [.. documents
            .Select(document => ScoreDocument(document, normalizedQuery, queryTrigrams))
            .Where(documentScore => documentScore.IsDirectMatch || documentScore.Similarity >= MinimumFuzzyMatchSimilarity)];
        List<RankedDocument> ranked = [.. scored
            .Select(documentScore => new RankedDocument(
                documentScore.ScoredSearchDocument,
                Rank(documentScore.ScoredSearchDocument, normalizedQuery, documentScore.Similarity, documentScore.IsDirectMatch)))
            .OrderByDescending(result => result.Rank)
            .ThenBy(result => result.RankedSearchDocument.Title)
            .ThenBy(result => result.RankedSearchDocument.EntityType)
            .ThenBy(result => result.RankedSearchDocument.EntityId)];
        List<RankedDocument> pagedResults = [.. ranked.Skip(query.Offset).Take(query.Limit)];
        Dictionary<Guid, string> pageIdentityHints = await LoadArtistIdentityHintsAsync(
            pagedResults.Select(result => result.RankedSearchDocument),
            cancellationToken);

        return new CollectionSearchResult(
            [.. pagedResults.Select(result => ReadResult(result.RankedSearchDocument, result.Rank, pageIdentityHints))],
            query.Limit,
            query.Offset,
            ranked.Count);
    }

    private static IQueryable<SearchDocument> ApplyFacetFilter(
        IQueryable<SearchDocument> documents,
        System.Linq.Expressions.Expression<Func<SearchDocument, string>> facetSelector,
        string normalizedFacet)
    {
        return normalizedFacet.Length == 0
            ? documents
            : documents.Where(ExpressionContains(facetSelector, FacetPattern(normalizedFacet)));
    }

    private static IQueryable<SearchDocument> ApplyLabelFilter(
        IQueryable<SearchDocument> documents,
        Guid? labelId,
        string normalizedLabelFacet)
    {
        if (!labelId.HasValue)
        {
            return documents;
        }

        string labelFacetPattern = FacetPattern(normalizedLabelFacet);
        return documents.Where(document => document.LabelId == labelId || document.LabelIdFacet.Contains(labelFacetPattern));
    }

    private static IQueryable<SearchDocument> ApplySavedViewFilter(IQueryable<SearchDocument> documents, string savedView)
    {
        return savedView switch
        {
            "" or "all" => documents,
            "credits" => documents.Where(document => document.RoleFacet != string.Empty),
            "remixes" => documents.Where(document => document.EntityType == "track" && document.RoleFacet.Contains("|remixer|")),
            "productions" => documents.Where(document => document.EntityType == "release" && document.RoleFacet.Contains("|producer|")),
            "labels" => documents.Where(document => document.EntityType == "label"),
            "needsdigitization" => documents.Where(document => document.StatusFacet.Contains("|needsdigitization|")),
            "physicalwithoutdigital" => documents.Where(document => document.CollectorSignalFacet.Contains("|physicalwithoutdigital|")),
            "lossywithoutlossless" or "mp3notlossless" => documents.Where(document => document.CollectorSignalFacet.Contains("|lossywithoutlossless|")),
            "wantednotowned" => documents.Where(document => document.CollectorSignalFacet.Contains("|wantednotowned|")),
            _ => documents.Where(document => false)
        };
    }

    private static System.Linq.Expressions.Expression<Func<SearchDocument, bool>> ExpressionContains(
        System.Linq.Expressions.Expression<Func<SearchDocument, string>> selector,
        string value)
    {
        System.Linq.Expressions.MethodCallExpression body = System.Linq.Expressions.Expression.Call(
            selector.Body,
            nameof(string.Contains),
            Type.EmptyTypes,
            System.Linq.Expressions.Expression.Constant(value));

        return System.Linq.Expressions.Expression.Lambda<Func<SearchDocument, bool>>(body, selector.Parameters);
    }

    private static string FacetPattern(string normalizedFacet)
    {
        return $"|{normalizedFacet}|";
    }

    private static DocumentScore ScoreDocument(SearchDocument document, string query, HashSet<string> queryTrigrams)
    {
        bool isDirectMatch = IsDirectMatch(document, query);
        decimal similarity = QuerySimilarity(document, queryTrigrams);

        return new DocumentScore(document, similarity, isDirectMatch);
    }

    private static decimal Rank(SearchDocument document, string query, decimal similarity, bool isDirectMatch)
    {
        decimal rank = similarity;
        if (isDirectMatch)
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

    private static decimal QuerySimilarity(SearchDocument document, HashSet<string> queryTrigrams)
    {
        decimal best = 0m;
        best = Math.Max(best, TrigramSimilarity(document.Title, queryTrigrams));
        best = Math.Max(best, TrigramSimilarity(document.Subtitle ?? string.Empty, queryTrigrams));
        best = Math.Max(best, TrigramSimilarity(document.Summary ?? string.Empty, queryTrigrams));
        best = Math.Max(best, TrigramSimilarity(document.SearchText, queryTrigrams));

        foreach (string token in SearchTokens(document.SearchText))
        {
            best = Math.Max(best, TrigramSimilarity(token, queryTrigrams));
        }

        return best;
    }

    private static decimal TrigramSimilarity(string value, HashSet<string> queryTrigrams)
    {
        HashSet<string> valueTrigrams = Trigrams(value);
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

    private sealed record DocumentScore(SearchDocument ScoredSearchDocument, decimal Similarity, bool IsDirectMatch);

    private sealed record RankedDocument(SearchDocument RankedSearchDocument, decimal Rank);
}
