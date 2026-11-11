namespace DiscWeave.Api.Features.Labels;

public sealed record LabelDiscogsPreferences
{
    public LabelDiscogsPreferences(string? discogsLabelId, string? discogsLabelName, string[] prefixes)
    {
        DiscogsLabelId = discogsLabelId;
        DiscogsLabelName = discogsLabelName;
        Prefixes = prefixes;
    }

    public string? DiscogsLabelId { get; init; }

    public string? DiscogsLabelName { get; init; }

    public string[] Prefixes { get; init; }

    public static LabelDiscogsPreferences Empty => new(null, null, []);
}
