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
