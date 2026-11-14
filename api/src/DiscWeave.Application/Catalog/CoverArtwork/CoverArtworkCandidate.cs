namespace DiscWeave.Application.Catalog.CoverArtwork;

public sealed record CoverArtworkCandidate
{
    public CoverArtworkCandidate(string imageId, string? comment, bool approved, IReadOnlyList<string> types, string sourceUrl)
    {
        ImageId = imageId;
        Comment = comment;
        Approved = approved;
        Types = types;
        SourceUrl = sourceUrl;
    }

    public string ImageId { get; init; }

    public string? Comment { get; init; }

    public bool Approved { get; init; }

    public IReadOnlyList<string> Types { get; init; }

    public string SourceUrl { get; init; }
}
