using System.Net.Http.Json;
using System.Net;
using System.Security.Cryptography;
using System.Text.Json;
using DiscWeave.Application.Catalog.CoverArtwork;
using DiscWeave.Application.Catalog.Releases;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Files;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace DiscWeave.Api.Tests;

public sealed partial class ReleaseExternalCoverArtworkEndpointTests
{
    private Task<ApiTestHost> CreateReleaseHostAsync(CoverTestDirectory root, FakeProvider provider, FaultStorage storage, CancelSaveInterceptor? interceptor = null)
    {
        return CreateHostAsync(root, services =>
        {
            _ = services.RemoveAll<IExternalCoverArtworkProvider>();
            _ = services.RemoveAll<IReleaseCoverStorage>();
            _ = services.RemoveAll<IReleaseCoverProvenanceStorage>();
            _ = services.AddSingleton<IExternalCoverArtworkProvider>(provider);
            _ = services.AddSingleton<IReleaseCoverStorage>(storage);
            _ = services.AddSingleton<IReleaseCoverProvenanceStorage>(storage);
            if (interceptor is not null)
            {
                _ = services.ConfigureDbContext<DiscWeaveDbContext>(options =>
                {
                    _ = options.AddInterceptors(interceptor);
                });
            }
        });
    }

    private static async Task<Guid> CreateReleaseAsync(HttpClient client)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/releases", new
        {
            title = "Fallen",
            type = "album",
            isVariousArtists = true,
            notOnLabel = true,
            genres = Array.Empty<string>(),
            tags = Array.Empty<string>()
        });
        return (await JsonAsync(response, HttpStatusCode.Created)).GetProperty("id").GetGuid();
    }

    private static string Route(Guid releaseId)
    {
        return $"/api/releases/{releaseId}/cover-artwork";
    }

    private static object Selection()
    {
        return new { releaseId = FakeProvider.EditionId, imageId = "12345" };
    }

    private static async Task<JsonElement> UploadOriginalAsync(HttpClient client, Guid releaseId)
    {
        using MultipartFormDataContent upload = Upload(CoverBytes(), "original.png");
        using HttpResponseMessage response = await client.PutAsync($"/api/releases/{releaseId}/cover-image", upload);
        return await JsonAsync(response, HttpStatusCode.OK);
    }

    private static async Task<JsonElement> ReleaseDetailAsync(HttpClient client, Guid releaseId)
    {
        using HttpResponseMessage response = await client.GetAsync($"/api/releases/{releaseId}");
        return await JsonAsync(response, HttpStatusCode.OK);
    }

    private sealed class FakeProvider : IExternalCoverArtworkProvider
    {
        public static readonly Guid EditionId = Guid.Parse("826f61ef-2d7f-4ecb-87e5-617119b235ac");
        public int Calls { get; private set; }
        public bool Fail { get; set; }
        public CoverReleaseSearchQuery? Query { get; private set; }
        public TaskCompletionSource? Pause { get; set; }
        public TaskCompletionSource DownloadEntered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public Task<IReadOnlyList<CoverReleaseCandidate>> SearchReleasesAsync(CoverReleaseSearchQuery query, CancellationToken cancellationToken)
        {
            Calls++;
            Query = query;
            IReadOnlyList<CoverReleaseCandidate> items = [new(EditionId, "Fallen", ["Steven Julien"], $"https://musicbrainz.org/release/{EditionId}")];
            return Task.FromResult(items);
        }

        public Task<IReadOnlyList<CoverArtworkCandidate>> GetFrontCoversAsync(Guid releaseId, CancellationToken cancellationToken)
        {
            Calls++;
            IReadOnlyList<CoverArtworkCandidate> items = [new("12345", "Front", true, ["Front"], $"https://coverartarchive.org/release/{releaseId}")];
            return Task.FromResult(items);
        }

        public async Task<DownloadedCoverArtwork> DownloadFrontCoverAsync(Guid releaseId, string imageId, bool preview, CancellationToken cancellationToken)
        {
            Calls++;
            _ = DownloadEntered.TrySetResult();
            if (Pause is not null)
            {
                await Pause.Task.WaitAsync(cancellationToken);
            }
            if (Fail)
            {
                throw new DomainException("external_cover.unavailable", "Provider unavailable");
            }

            byte[] bytes = FrontBytes();
            var provenance = new CoverArtworkProvenance("coverArtArchive", releaseId, imageId,
                $"https://coverartarchive.org/release/{releaseId}", DateTimeOffset.UtcNow, Convert.ToHexString(SHA256.HashData(bytes)));
            return new DownloadedCoverArtwork(bytes, "image/png", ".png", "external.png", provenance);
        }
    }

    private sealed class FaultStorage : IReleaseCoverStorage, IReleaseCoverProvenanceStorage
    {
        private readonly FileSystemReleaseCoverStorage _inner;
        public bool FailSave { get; set; }
        public bool FailProvenance { get; set; }
        public string? FailDeleteKey { get; set; }
        public List<string> SavedKeys { get; } = [];
        public List<string> DeleteAttempts { get; } = [];

        public FaultStorage(string root)
        {
            _inner = new FileSystemReleaseCoverStorage(Options.Create(new ReleaseCoverStorageOptions { StorageRoot = root }));
        }

        public async Task<ReleaseCoverStoredFile> SaveAsync(CollectionId collectionId, ReleaseId releaseId, string extension, Stream content, CancellationToken cancellationToken)
        {
            if (FailSave)
            {
                throw new IOException("Simulated storage failure");
            }
            ReleaseCoverStoredFile saved = await _inner.SaveAsync(collectionId, releaseId, extension, content, cancellationToken);
            SavedKeys.Add(saved.StorageKey);
            return saved;
        }

        public Task<Stream?> TryOpenReadAsync(string storageKey, CancellationToken cancellationToken)
        {
            return _inner.TryOpenReadAsync(storageKey, cancellationToken);
        }

        public Task DeleteAsync(string storageKey, CancellationToken cancellationToken)
        {
            DeleteAttempts.Add(storageKey);
            return storageKey == FailDeleteKey
                ? throw new IOException("Simulated cleanup failure")
                : _inner.DeleteAsync(storageKey, cancellationToken);
        }

        public Task SaveAsync(string storageKey, CoverArtworkProvenance provenance, CancellationToken cancellationToken)
        {
            return FailProvenance
                ? throw new IOException("Simulated provenance write failure")
                : _inner.SaveAsync(storageKey, provenance, cancellationToken);
        }

        public Task<CoverArtworkProvenance?> ReadAsync(string storageKey, CancellationToken cancellationToken)
        {
            return _inner.ReadAsync(storageKey, cancellationToken);
        }
    }

    private sealed class CancelSaveInterceptor : SaveChangesInterceptor
    {
        public bool Enabled { get; set; }
        public bool Cancelled { get; private set; }

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (Enabled && eventData.Context?.ChangeTracker.Entries<Release>().Any(entry => entry.State == EntityState.Modified) == true)
            {
                Cancelled = true;
                throw new OperationCanceledException("Simulated save cancellation", new CancellationToken(canceled: true));
            }
            return base.SavingChangesAsync(eventData, result, cancellationToken);
        }
    }
}
