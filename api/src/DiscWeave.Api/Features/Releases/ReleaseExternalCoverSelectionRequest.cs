namespace DiscWeave.Api.Features.Releases;

public sealed record ReleaseExternalCoverSelectionRequest
{
    public ReleaseExternalCoverSelectionRequest(Guid releaseId, string imageId)
    {
        ReleaseId = releaseId;
        ImageId = imageId;
    }

    public Guid ReleaseId { get; init; }

    public string ImageId { get; init; }
}
