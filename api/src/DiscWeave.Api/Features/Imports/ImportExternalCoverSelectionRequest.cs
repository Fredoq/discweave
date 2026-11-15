namespace DiscWeave.Api.Features.Imports;

public sealed record ImportExternalCoverSelectionRequest
{
    public ImportExternalCoverSelectionRequest(Guid releaseId, string imageId)
    {
        ReleaseId = releaseId;
        ImageId = imageId;
    }

    public Guid ReleaseId { get; init; }

    public string ImageId { get; init; }
}
