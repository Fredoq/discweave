namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

internal static class DiscogsEnumerableExtensions
{
    public static string[] WhereNotBlank(this IEnumerable<string?> values)
    {
        return
        [
            .. values
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => value!.Trim())
        ];
    }
}

internal static class DiscogsReleaseTypeDescriptions
{
    private static readonly HashSet<string> Values =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "Album",
            "Compilation",
            "EP",
            "Maxi-Single",
            "Mini-Album",
            "Mixtape",
            "Mixed",
            "Partially Unofficial",
            "Promo",
            "Sampler",
            "Single",
            "Unofficial Release"
        };

    public static bool Contains(string value)
    {
        return Values.Contains(value);
    }
}
