using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Interfaces;

namespace DiscWeave.Domain.Collection;

public sealed class DigitalTrackFileLink : IEntity<DigitalTrackFileLinkId>
{
    private DigitalTrackFileLink()
    {
    }

    private DigitalTrackFileLink(
        CollectionId collectionId,
        DigitalTrackFileLinkId id,
        OwnedItemId digitalOwnedItemId,
        ReleaseTrackId releaseTrackId,
        LocalAudioFileId localAudioFileId)
    {
        CollectionId = collectionId;
        Id = id;
        DigitalOwnedItemId = digitalOwnedItemId;
        ReleaseTrackId = releaseTrackId;
        LocalAudioFileId = localAudioFileId;
    }

    public CollectionId CollectionId { get; private set; }

    public DigitalTrackFileLinkId Id { get; private set; }

    public OwnedItemId DigitalOwnedItemId { get; private set; }

    public ReleaseTrackId ReleaseTrackId { get; private set; }

    public LocalAudioFileId LocalAudioFileId { get; private set; }

    public static DigitalTrackFileLink Create(
        CollectionId collectionId,
        DigitalTrackFileLinkId id,
        OwnedItemId digitalOwnedItemId,
        ReleaseTrackId releaseTrackId,
        LocalAudioFileId localAudioFileId)
    {
        return new DigitalTrackFileLink(collectionId, id, digitalOwnedItemId, releaseTrackId, localAudioFileId);
    }

    public DigitalTrackFileLink Relink(LocalAudioFileId localAudioFileId)
    {
        LocalAudioFileId = localAudioFileId;
        return this;
    }
}
