namespace DiscWeave.Api.Features.Labels;

public sealed record LabelDiscogsPreferencesRequest
{
    public LabelDiscogsPreferencesRequest(string? discogsLabelId, string[]? prefixes)
    {
        DiscogsLabelId = discogsLabelId;
        Prefixes = prefixes;
    }

    public string? DiscogsLabelId { get; init; }

    public string[]? Prefixes { get; init; }
}
