namespace DiscWeave.Api.Features.Imports;

public sealed record EntitySuggestionResponse(Guid Id, string Name, string Match, string? IdentityHint = null);
