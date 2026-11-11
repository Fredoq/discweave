using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Api.Tests;

internal sealed partial class ApiTestHost
{
    public async Task MakePreviousArchiveSchemaAsync()
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        _ = await context.Database.ExecuteSqlRawAsync("DROP TABLE label_import_session_links");
    }

    public async Task MakeUnknownArchiveSchemaAsync()
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        _ = await context.Database.ExecuteSqlRawAsync("CREATE TABLE unrecognized_archive_extension (id INTEGER PRIMARY KEY)");
    }

    public async Task AssertArchiveCatalogWasNotChangedAsync()
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        Assert.Equal(1, await context.Labels.CountAsync());
        Assert.Equal(2, await context.ReleaseImportSessions.CountAsync());
        Assert.Equal(2, await context.ReleaseImportDrafts.CountAsync());
        Assert.Empty(await context.Releases.ToArrayAsync());
    }
}
