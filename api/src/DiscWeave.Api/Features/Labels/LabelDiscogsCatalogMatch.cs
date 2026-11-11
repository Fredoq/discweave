namespace DiscWeave.Api.Features.Labels;

public sealed record LabelDiscogsCatalogMatch
{
    public LabelDiscogsCatalogMatch(Guid releaseId, string title, bool inCollection, bool wanted)
    {
        ReleaseId = releaseId;
        Title = title;
        InCollection = inCollection;
        Wanted = wanted;
    }

    public Guid ReleaseId { get; init; }

    public string Title { get; init; }

    public bool InCollection { get; init; }

    public bool Wanted { get; init; }
}
