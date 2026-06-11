using DiscWeave.Api.Auth;
using DiscWeave.Api.Http;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Api.Features.Settings;

public static class SettingsDiscogsIntegrationsEndpointRouteBuilderExtensions
{
    public static IEndpointRouteBuilder MapSettingsDiscogsIntegrationsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder group = endpoints.MapGroup("/api/settings/integrations/discogs")
            .WithTags("Settings")
            .RequireAuthorization(DiscWeaveAuthorizationPolicies.CollectionMember);

        _ = group.MapGet("", GetStatusAsync).WithName("GetDiscogsIntegrationStatus");
        _ = group.MapPut("/token", SaveTokenAsync).WithName("SaveDiscogsIntegrationToken");
        _ = group.MapDelete("/token", ClearTokenAsync).WithName("ClearDiscogsIntegrationToken");

        return endpoints;
    }

    private static async Task<IResult> GetStatusAsync(
        IDiscogsIntegrationSettingsStore settings,
        CancellationToken cancellationToken)
    {
        return Results.Ok(await ToResponseAsync(settings, cancellationToken));
    }

    private static async Task<IResult> SaveTokenAsync(
        DiscogsAccessTokenRequest request,
        IDiscogsIntegrationSettingsStore settings,
        CancellationToken cancellationToken)
    {
        if (!DiscogsIntegrationSettingsStore.IsValidAccessToken(request.AccessToken))
        {
            return EndpointErrors.BadRequest(
                "settings.integrations.discogs.token_invalid",
                "Discogs access token is required and must not contain control characters");
        }

        await settings.SaveAccessTokenAsync(request.AccessToken!, cancellationToken);
        return Results.Ok(await ToResponseAsync(settings, cancellationToken));
    }

    private static async Task<IResult> ClearTokenAsync(
        IDiscogsIntegrationSettingsStore settings,
        CancellationToken cancellationToken)
    {
        await settings.ClearAccessTokenAsync(cancellationToken);
        return Results.Ok(await ToResponseAsync(settings, cancellationToken));
    }

    private static async Task<DiscogsIntegrationStatusResponse> ToResponseAsync(
        IDiscogsIntegrationSettingsStore settings,
        CancellationToken cancellationToken)
    {
        bool configured = await settings.IsConfiguredAsync(cancellationToken);

        return new DiscogsIntegrationStatusResponse(
            "discogs",
            configured,
            configured);
    }
}
