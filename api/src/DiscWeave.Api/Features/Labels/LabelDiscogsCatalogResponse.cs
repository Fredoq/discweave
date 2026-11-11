namespace DiscWeave.Api.Features.Labels;

public sealed record LabelDiscogsCatalogResponse
{
    public LabelDiscogsCatalogResponse(IReadOnlyList<LabelDiscogsCatalogItemResponse> items, int page, int pageSize, int total, int pages, string discogsLabelId, string discogsLabelName)
    {
        Items = items;
        Page = page;
        PageSize = pageSize;
        Total = total;
        Pages = pages;
        DiscogsLabelId = discogsLabelId;
        DiscogsLabelName = discogsLabelName;
    }

    public IReadOnlyList<LabelDiscogsCatalogItemResponse> Items { get; init; }

    public int Page { get; init; }

    public int PageSize { get; init; }

    public int Total { get; init; }

    public int Pages { get; init; }

    public string DiscogsLabelId { get; init; }

    public string DiscogsLabelName { get; init; }
}
