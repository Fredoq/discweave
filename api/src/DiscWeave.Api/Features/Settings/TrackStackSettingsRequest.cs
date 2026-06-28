namespace DiscWeave.Api.Features.Settings;

public sealed record TrackStackSettingsRequest
{
    public IReadOnlyList<string> DefaultRelationTypeCodes { get; init; } = [];
}

public sealed record TrackStackSettingsResponse(IReadOnlyList<string> DefaultRelationTypeCodes);
