namespace DiscWeave.Api.Features.Releases;

public sealed record ReleaseDatePreviewRequest
{
    public ReleaseDatePreviewRequest(string discogsReleaseId)
    {
        DiscogsReleaseId = discogsReleaseId;
    }

    public string DiscogsReleaseId { get; }
}
