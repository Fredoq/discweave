using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Relations;

public sealed record TrackRelationIdentity(string Value)
{
    public static TrackRelationIdentity From(TrackId sourceTrackId, TrackId targetTrackId, string type)
    {
        return new TrackRelationIdentity($"{sourceTrackId.Value:D}|{targetTrackId.Value:D}|{type}");
    }
}
