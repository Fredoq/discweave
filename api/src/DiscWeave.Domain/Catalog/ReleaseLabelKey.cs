namespace DiscWeave.Domain.Catalog;

public sealed record ReleaseLabelKey(string Value)
{
    public static ReleaseLabelKey From(ReleaseLabel label)
    {
        ArgumentNullException.ThrowIfNull(label);

        string catalogPart = label.CatalogNumber.Match(
            present => $"catalog:{NormalizeCatalogNumberKey(present)}",
            () => label.HasNoCatalogNumber ? "no-number" : "missing-number");

        return new ReleaseLabelKey($"{label.LabelId.Value:D}|{catalogPart}");
    }

    private static string NormalizeCatalogNumberKey(string value)
    {
        return string.Join(' ', value.Trim().ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }
}
