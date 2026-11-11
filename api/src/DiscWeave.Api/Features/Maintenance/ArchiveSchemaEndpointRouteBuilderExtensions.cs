using DiscWeave.Api.Auth;
using DiscWeave.Api.Hosting;
using DiscWeave.Api.Http;
using DiscWeave.Infrastructure.LocalDesktop;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;

namespace DiscWeave.Api.Features.Maintenance;

public static class ArchiveSchemaEndpointRouteBuilderExtensions
{
    public static IEndpointRouteBuilder MapArchiveSchemaEndpoints(this IEndpointRouteBuilder endpoints)
    {
        _ = endpoints.MapGet("/api/maintenance/schema", GetStatusAsync)
            .WithName("GetArchiveSchemaStatus")
            .WithTags("Maintenance");
        return endpoints;
    }

    private static async Task<IResult> GetStatusAsync(HttpContext request, DiscWeaveDbContext context, IAuthorizationService authorization, IConfiguration configuration, CancellationToken cancellationToken)
    {
        bool trustedDesktop = ArchiveMaintenanceCommand.IsLocalDesktopMode() && LocalDesktopRequestTrust.IsTrusted(request);
        if (!trustedDesktop && !(await authorization.AuthorizeAsync(request.User, DiscWeaveAuthorizationPolicies.CollectionMember)).Succeeded)
        {
            return EndpointErrors.Unauthorized("auth.unauthenticated", "An authenticated collection session is required");
        }

        ArchiveSchemaStatus status = await InspectAsync(context, cancellationToken);
        bool canUpgrade = status.CanUpgrade && trustedDesktop && !ArchiveMaintenanceCommand.HasCustomArchivePaths(configuration);
        return Results.Ok(status with { CanUpgrade = canUpgrade });
    }

    internal static async Task<IResult?> RequireLabelImportSchemaAsync(DiscWeaveDbContext context, CancellationToken cancellationToken)
    {
        ArchiveSchemaStatus status = await InspectAsync(context, cancellationToken);
        return status.Status switch
        {
            "current" => null,
            "upgradeRequired" => EndpointErrors.Conflict("schema.upgrade_required", "Back up and upgrade the archive to link label imports. Existing collection and import views remain available."),
            _ => EndpointErrors.Conflict("schema.unsupported", "This archive schema is not recognized. No upgrade was performed."),
        };
    }

    private static Task<ArchiveSchemaStatus> InspectAsync(DiscWeaveDbContext context, CancellationToken cancellationToken)
    {
        return ArchiveSchemaMaintenance.InspectDatabaseAsync(Path.GetFullPath(context.Database.GetDbConnection().DataSource), cancellationToken);
    }
}
