namespace DiscWeave.Api.Features.Labels;

public sealed record LabelDiscogsCatalogItemResponse
{
    public required string ExternalId { get; init; }

    public required string CatalogNumber { get; init; }

    public required string Artist { get; init; }

    public required string Title { get; init; }

    public required int Year { get; init; }

    public required string Format { get; init; }

    public required string MatchKind { get; init; }

    public required IReadOnlyList<LabelDiscogsCatalogMatch> Matches { get; init; }
}
