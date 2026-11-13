namespace DiscWeave.Api.Features.Releases;

internal sealed record ReleaseDatePreviewToken
{
    public ReleaseDatePreviewToken(Guid collectionId, Guid releaseId, string fingerprint, DateOnly date)
    {
        CollectionId = collectionId;
        ReleaseId = releaseId;
        Fingerprint = fingerprint;
        Date = date;
    }

    public Guid CollectionId { get; }

    public Guid ReleaseId { get; }

    public string Fingerprint { get; }

    public DateOnly Date { get; }
}
