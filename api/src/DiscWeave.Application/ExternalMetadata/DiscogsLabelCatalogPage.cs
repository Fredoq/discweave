namespace DiscWeave.Application.ExternalMetadata;

public sealed record DiscogsLabelCatalogPage
{
    public DiscogsLabelCatalogPage(IReadOnlyList<DiscogsLabelCatalogItem> items, int page, int pageSize, int total, int pages)
    {
        Items = items;
        Page = page;
        PageSize = pageSize;
        Total = total;
        Pages = pages;
    }

    public IReadOnlyList<DiscogsLabelCatalogItem> Items { get; init; }

    public int Page { get; init; }

    public int PageSize { get; init; }

    public int Total { get; init; }

    public int Pages { get; init; }
}
