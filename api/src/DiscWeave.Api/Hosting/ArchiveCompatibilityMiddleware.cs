using DiscWeave.Api.Http;
using DiscWeave.Infrastructure.LocalDesktop;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Hosting;

public static class ArchiveCompatibilityMiddleware
{
    public static IApplicationBuilder UseArchiveCompatibility(this IApplicationBuilder app)
    {
        return app.Use(async (request, next) =>
        {
            if (!request.Request.Path.StartsWithSegments("/api") || request.Request.Path == "/api/maintenance/schema")
            {
                await next(request);
                return;
            }

            DiscWeaveDbContext context = request.RequestServices.GetRequiredService<DiscWeaveDbContext>();
            ArchiveSchemaStatus status = await ArchiveSchemaMaintenance.InspectDatabaseAsync(
                Path.GetFullPath(context.Database.GetDbConnection().DataSource), request.RequestAborted);
            if (status.Status == "unsupported")
            {
                request.Response.StatusCode = StatusCodes.Status409Conflict;
                await request.Response.WriteAsJsonAsync(new ErrorResponse(
                    "schema.unsupported", "This archive schema is not recognized. Collection access is paused to protect your data."), request.RequestAborted);
                return;
            }

            await next(request);
        });
    }
}
