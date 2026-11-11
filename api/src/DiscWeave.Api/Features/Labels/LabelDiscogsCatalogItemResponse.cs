namespace DiscWeave.Api.Features.Labels;

public sealed record LabelDiscogsCatalogItemResponse
{
    public LabelDiscogsCatalogItemResponse(string externalId, string catalogNumber, string artist, string title, int year, string format, string matchKind, IReadOnlyList<LabelDiscogsCatalogMatch> matches)
    {
        ExternalId = externalId;
        CatalogNumber = catalogNumber;
        Artist = artist;
        Title = title;
        Year = year;
        Format = format;
        MatchKind = matchKind;
        Matches = matches;
    }

    public string ExternalId { get; init; }

    public string CatalogNumber { get; init; }

    public string Artist { get; init; }

    public string Title { get; init; }

    public int Year { get; init; }

    public string Format { get; init; }

    public string MatchKind { get; init; }

    public IReadOnlyList<LabelDiscogsCatalogMatch> Matches { get; init; }
}
