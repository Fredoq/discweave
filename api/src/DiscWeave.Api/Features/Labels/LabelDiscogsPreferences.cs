namespace DiscWeave.Api.Features.Labels;

public sealed record LabelDiscogsPreferences(string? DiscogsLabelId, string? DiscogsLabelName, string[] Prefixes)
{
    public static LabelDiscogsPreferences Empty => new(null, null, []);
}

public sealed record LabelDiscogsPreferencesRequest(string? DiscogsLabelId, string[]? Prefixes);
