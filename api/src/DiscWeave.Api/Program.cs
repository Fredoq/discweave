using DiscWeave.Api.Features.Discover;
using DiscWeave.Api.Features.Maintenance;
using DiscWeave.Api;
using DiscWeave.Api.Features;
using DiscWeave.Api.Features.Tracks;
using DiscWeave.Api.Features.Imports;
using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Api.Hosting;
using DiscWeave.Application;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure;

if (ArchiveMaintenanceCommand.IsMaintenanceCommand(args))
{
    Environment.ExitCode = await ArchiveMaintenanceCommand.RunAsync(args[0]);
    return;
}

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.Services.AddDiscWeaveApplication();
builder.Services.AddDiscWeaveInfrastructure(builder.Configuration);
builder.Services.AddProductionSecurity(builder.Configuration);
builder.Services.AddScoped<ReleaseImportConfirmationService>();
builder.Services.AddScoped<
    ILocalOriginalCandidateService,
    LocalOriginalCandidateService>();
builder.Services.AddScoped<
    IExternalOriginalCandidateService,
    ExternalOriginalCandidateService>();
builder.Services.AddScoped<TrackStackAssignmentService>();
builder.Services.AddScoped<ExternalReleaseDraftService>();
builder.Services.AddScoped<IExternalReleaseBindingValidator, ExternalReleaseBindingValidator>();
builder.Services.AddScoped<ExternalReleaseProvenanceSelectionService>();
builder.Services.AddScoped<ExternalReleaseBindingRebindService>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<DiscoverSnapshots>();
builder.Services.AddSingleton<DiscoverHistoryStore>();
builder.Services.AddScoped<DiscoverProfileService>();
builder.Services.AddScoped<DiscoverResolver>();
builder.Services.AddDiscWeaveAuthentication(builder.Environment);
builder.Services.AddDiscWeaveRequestContext();

WebApplication app = builder.Build();
using IDisposable? archiveLease = ArchiveMaintenanceCommand.AcquireRuntimeLease(app.Services);

await using (AsyncServiceScope startupScope = app.Services.CreateAsyncScope())
{
    _ = startupScope.ServiceProvider.GetRequiredService<IExternalMetadataProviderResolver>();
}

if (DiscWeaveHostConfiguration.UsesSqliteStorage(builder.Configuration))
{
    await DiscWeaveHostConfiguration.InitializeSqliteDatabaseAsync(app.Services);
}

app.UseProductionSecurity();
app.UseLocalDesktopRequestTrust(builder.Configuration);
app.UseArchiveCompatibility();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

app.MapDiscWeaveEndpoints();
app.MapArchiveSchemaEndpoints();

app.MapGet("/health", () =>
{
    HealthResponse response = new()
    {
        Service = "discweave",
        Status = "ok"
    };

    return Results.Ok(response);
})
.WithName("GetHealth");

await app.RunAsync();
return;
