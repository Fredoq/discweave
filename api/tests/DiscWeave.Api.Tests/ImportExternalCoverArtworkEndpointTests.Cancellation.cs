using DiscWeave.Domain.Imports;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ImportExternalCoverArtworkEndpointTests
{
    [Fact]
    public async Task A_cancelled_database_save_restores_provenance_for_identical_downloaded_artwork()
    {
        using var root = new CoverTestDirectory();
        var provider = new FakeCoverProvider();
        var interceptor = new CancelCoverSaveInterceptor();
        await using ApiTestHost host = await CreateExternalHostAsync(root, provider, interceptor);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonElement scan = await ScanAsync(client, root.Source);
        string route = ArtworkRoute(scan);
        JsonElement original = await SelectExternalAsync(client, route);
        interceptor.Enabled = true;
        using HttpResponseMessage cancelled = await client.PostAsJsonAsync(route + "/external-selection", OtherSelection());
        Assert.False(cancelled.IsSuccessStatusCode);
        Assert.True(interceptor.Cancelled);
        JsonElement retained = await GetArtworkAsync(client, route);
        AssertProvenance(retained);
        Assert.Equal(original.GetProperty("selected").GetProperty("provenance").GetRawText(), retained.GetProperty("selected").GetProperty("provenance").GetRawText());
        await AssertImageAsync(client, retained.GetProperty("selected").GetProperty("url").GetString(), FrontBytes());
    }

    private sealed class CancelCoverSaveInterceptor : SaveChangesInterceptor
    {
        public bool Enabled { get; set; }
        public bool Cancelled { get; private set; }

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (Enabled && eventData.Context?.ChangeTracker.Entries<ReleaseImportDraft>().Any(entry => entry.State == EntityState.Modified) == true)
            {
                Cancelled = true;
                throw new OperationCanceledException("Simulated cover save cancellation", new CancellationToken(canceled: true));
            }

            return base.SavingChangesAsync(eventData, result, cancellationToken);
        }
    }
}
