using DiscWeave.Infrastructure.Persistence.Search;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Persistence.Queries;

public sealed partial class CollectionSearchQueries
{
    private static IQueryable<SearchDocument> ApplyQueryCandidateFilter(
        IQueryable<SearchDocument> documents,
        IReadOnlyList<string> candidateTerms)
    {
        System.Linq.Expressions.ParameterExpression parameter =
            System.Linq.Expressions.Expression.Parameter(typeof(SearchDocument), "document");
        System.Linq.Expressions.Expression? body = null;
        foreach (string candidateTerm in candidateTerms)
        {
            string pattern = $"%{candidateTerm}%";
            System.Linq.Expressions.MethodCallExpression likeCall = System.Linq.Expressions.Expression.Call(
                typeof(DbFunctionsExtensions),
                nameof(DbFunctionsExtensions.Like),
                Type.EmptyTypes,
                System.Linq.Expressions.Expression.Property(null, typeof(EF), nameof(EF.Functions)),
                System.Linq.Expressions.Expression.Property(parameter, nameof(SearchDocument.SearchText)),
                System.Linq.Expressions.Expression.Constant(pattern));
            body = body is null ? likeCall : System.Linq.Expressions.Expression.OrElse(body, likeCall);
        }

        return body is null
            ? documents.Where(_ => false)
            : documents.Where(System.Linq.Expressions.Expression.Lambda<Func<SearchDocument, bool>>(body, parameter));
    }

    private static string[] CandidateTerms(string value)
    {
        return
        [
            .. SearchTokens(value)
                .SelectMany(token => token.Length <= 3 ? [token] : TrigramTerms(token))
                .Where(term => term.Length > 0)
                .Distinct(StringComparer.Ordinal)
                .Take(24)
        ];
    }

    private static IEnumerable<string> TrigramTerms(string token)
    {
        for (int index = 0; index <= token.Length - 3; index++)
        {
            yield return token.Substring(index, 3);
        }
    }
}
