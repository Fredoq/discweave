using System.Security.Cryptography;
using System.Text;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Features.ReviewWorkbench;

internal static class ReviewWorkbenchStableKey
{
    public static string Create(
        CollectionId collectionId,
        string category,
        string subtype,
        string sourceDetector,
        IReadOnlyList<ReviewWorkbenchSignalTarget> targets,
        string? comparisonKey)
    {
        string[] targetTokens = [.. targets
            .Select(target => $"{target.Kind}:{target.Id:D}")
            .Order(StringComparer.Ordinal)];
        string keyMaterial = string.Join(
            '\n',
            collectionId.Value.ToString("D"),
            category,
            subtype,
            sourceDetector,
            string.Join('|', targetTokens),
            NormalizeComparisonKey(comparisonKey));
        byte[] hash = SHA256.HashData(Encoding.UTF8.GetBytes(keyMaterial));

        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static string NormalizeComparisonKey(string? comparisonKey)
    {
        return string.IsNullOrWhiteSpace(comparisonKey)
            ? string.Empty
            : comparisonKey.Trim().ToUpperInvariant();
    }
}
