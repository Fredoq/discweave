namespace DiscWeave.Api.Features.Labels;

public sealed record LabelDiscogsCatalogResponse(
    IReadOnlyList<LabelDiscogsCatalogItemResponse> Items, int Page, int PageSize, int Total, int Pages,
    string DiscogsLabelId, string DiscogsLabelName);

public sealed record LabelDiscogsCatalogItemResponse(
    string ExternalId, string CatalogNumber, string Artist, string Title, int Year, string Format,
    string MatchKind, IReadOnlyList<LabelDiscogsCatalogMatch> Matches);

public sealed record LabelDiscogsCatalogMatch(Guid ReleaseId, string Title, bool InCollection, bool Wanted);
