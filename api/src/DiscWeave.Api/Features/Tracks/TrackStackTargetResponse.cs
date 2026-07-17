namespace DiscWeave.Api.Features.Tracks;

public sealed class TrackStackTargetResponse
{
    public TrackStackTargetResponse(
        Guid rootTrackId,
        string title,
        string artistDisplay,
        int? versionYear,
        int memberCount,
        TrackStackTargetMatchedMemberResponse? matchedMember)
    {
        RootTrackId = rootTrackId;
        Title = title;
        ArtistDisplay = artistDisplay;
        VersionYear = versionYear;
        MemberCount = memberCount;
        MatchedMember = matchedMember;
    }

    public Guid RootTrackId { get; }
    public string Title { get; }
    public string ArtistDisplay { get; }
    public int? VersionYear { get; }
    public int MemberCount { get; }
    public TrackStackTargetMatchedMemberResponse? MatchedMember { get; }
}
