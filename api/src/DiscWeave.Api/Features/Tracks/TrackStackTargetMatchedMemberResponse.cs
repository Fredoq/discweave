namespace DiscWeave.Api.Features.Tracks;

public sealed class TrackStackTargetMatchedMemberResponse
{
    public TrackStackTargetMatchedMemberResponse(
        Guid trackId,
        string title,
        string artistDisplay)
    {
        TrackId = trackId;
        Title = title;
        ArtistDisplay = artistDisplay;
    }

    public Guid TrackId { get; }
    public string Title { get; }
    public string ArtistDisplay { get; }
}
