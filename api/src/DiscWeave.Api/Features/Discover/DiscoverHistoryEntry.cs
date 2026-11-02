namespace DiscWeave.Api.Features.Discover;

public sealed record DiscoverHistoryEntry(string ExternalId, string[] Keys, string Kind, DateTimeOffset At, string Artist = "", string Title = "");
