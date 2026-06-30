using DiscWeave.Api.Auth;
using DiscWeave.Api.Http;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Settings;

public static class SettingsTrackStackEndpointRouteBuilderExtensions
{
    public static IEndpointRouteBuilder MapSettingsTrackStackEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder group = endpoints.MapGroup("/api/settings/track-stack")
            .WithTags("Settings")
            .RequireAuthorization(DiscWeaveAuthorizationPolicies.CollectionMember);

        _ = group.MapGet("", GetTrackStackSettingsAsync).WithName("GetTrackStackSettings");
        _ = group.MapPut("", UpdateTrackStackSettingsAsync).WithName("UpdateTrackStackSettings");

        return endpoints;
    }

    private static async Task<IResult> GetTrackStackSettingsAsync(
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<string> relationTypeCodes = await TrackStackSettingsReader.GetDefaultRelationTypeCodesAsync(
            context,
            currentCollection.CollectionId,
            cancellationToken);

        return Results.Ok(new TrackStackSettingsResponse(relationTypeCodes));
    }

    private static async Task<IResult> UpdateTrackStackSettingsAsync(
        TrackStackSettingsRequest request,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        try
        {
            IReadOnlyList<string> relationTypeCodes = await DictionaryValidation.RequireActiveCodesAsync(
                context,
                currentCollection.CollectionId,
                DictionaryKind.TrackRelationType,
                request.DefaultRelationTypeCodes,
                "track_stack_settings.relation_type_invalid",
                "Track stack relation type is invalid",
                cancellationToken);

            TrackStackSettings? settings = await context.TrackStackSettings.SingleOrDefaultAsync(
                item => item.CollectionId == currentCollection.CollectionId,
                cancellationToken);
            if (settings is null)
            {
                settings = TrackStackSettings.Create(currentCollection.CollectionId, relationTypeCodes);
                _ = context.TrackStackSettings.Add(settings);
            }
            else
            {
                settings.UpdateDefaultRelationTypeCodes(relationTypeCodes);
            }

            _ = await context.SaveChangesAsync(cancellationToken);

            return Results.Ok(new TrackStackSettingsResponse(settings.DefaultRelationTypeCodes));
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
    }
}
