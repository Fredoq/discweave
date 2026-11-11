namespace DiscWeave.Application.ExternalMetadata;

public sealed record DiscogsLabelCandidate
{
    public DiscogsLabelCandidate(string externalId, string name)
    {
        ExternalId = externalId;
        Name = name;
    }

    public string ExternalId { get; init; }

    public string Name { get; init; }
}
