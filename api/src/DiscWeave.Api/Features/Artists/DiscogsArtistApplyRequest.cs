namespace DiscWeave.Api.Features.Artists;

public sealed record DiscogsArtistApplyRequest
{
    public required DiscogsArtistApplySourceRequest Source { get; init; }

    public required string Name { get; init; }

    public IReadOnlyList<string> Aliases { get; init; } = [];

    public IReadOnlyList<string> Members { get; init; } = [];

    public IReadOnlyList<string> NameVariations { get; init; } = [];

    public string? Profile { get; init; }
}

public sealed record DiscogsArtistApplySourceRequest(
    string ProviderName,
    string ResourceType,
    string ExternalId,
    string SourceUrl);

public sealed record DiscogsArtistApplySummaryResponse(
    int CreatedMemberArtists,
    int ReusedMemberArtists,
    int CreatedMemberRelations);
