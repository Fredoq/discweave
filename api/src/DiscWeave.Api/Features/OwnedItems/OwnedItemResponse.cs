namespace DiscWeave.Api.Features.OwnedItems;

public sealed record OwnedItemResponse(
    Guid Id,
    Guid ReleaseId,
    OwnedItemReleaseResponse Release,
    string Status,
    MediumResponse Medium,
    OwnedItemDetailsResponse Details,
    IReadOnlyList<string> InventorySignals);

public sealed record OwnedItemReleaseResponse(Guid Id, string Title);

public sealed record OwnedItemDetailsResponse(
    DigitalOwnedItemDetailsResponse? Digital,
    VinylOwnedItemDetailsResponse? Vinyl,
    CdOwnedItemDetailsResponse? Cd,
    CassetteOwnedItemDetailsResponse? Cassette,
    OtherOwnedItemDetailsResponse? Other)
{
    public static OwnedItemDetailsResponse ForDigital(DigitalOwnedItemDetailsResponse details)
    {
        return new OwnedItemDetailsResponse(details, null, null, null, null);
    }

    public static OwnedItemDetailsResponse ForVinyl(VinylOwnedItemDetailsResponse details)
    {
        return new OwnedItemDetailsResponse(null, details, null, null, null);
    }

    public static OwnedItemDetailsResponse ForCd(CdOwnedItemDetailsResponse details)
    {
        return new OwnedItemDetailsResponse(null, null, details, null, null);
    }

    public static OwnedItemDetailsResponse ForCassette(CassetteOwnedItemDetailsResponse details)
    {
        return new OwnedItemDetailsResponse(null, null, null, details, null);
    }

    public static OwnedItemDetailsResponse ForOther(OtherOwnedItemDetailsResponse details)
    {
        return new OwnedItemDetailsResponse(null, null, null, null, details);
    }
}

public sealed record DigitalOwnedItemDetailsResponse(
    int ReleaseTrackCount,
    int LinkedFileCount,
    int MissingFileCount,
    IReadOnlyList<DigitalFileCoverageResponse> Files);

public sealed record DigitalFileCoverageResponse(
    Guid DigitalTrackFileLinkId,
    Guid ReleaseTrackId,
    Guid TrackId,
    string TrackTitle,
    int Position,
    string? Disc,
    string? Side,
    Guid LocalAudioFileId,
    string Path,
    string? Format,
    string? Codec,
    string? Quality,
    long? SizeBytes,
    DateTimeOffset? ModifiedAt,
    string? ContentHash,
    int? DurationSeconds,
    int? BitrateKbps,
    int? SampleRateHz,
    int? Channels);

public sealed record VinylOwnedItemDetailsResponse(
    string FormatDescription,
    string? Condition,
    string? StorageLocation);

public sealed record CdOwnedItemDetailsResponse(
    int DiscCount,
    string? Condition,
    string? StorageLocation);

public sealed record CassetteOwnedItemDetailsResponse(
    string TapeType,
    string? Condition,
    string? StorageLocation);

public sealed record OtherOwnedItemDetailsResponse(
    string Name,
    string? Condition,
    string? StorageLocation);
