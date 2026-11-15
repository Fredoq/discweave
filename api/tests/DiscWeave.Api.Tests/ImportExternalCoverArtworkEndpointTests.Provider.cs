using DiscWeave.Application.Catalog.CoverArtwork;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using System.Security.Cryptography;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ImportExternalCoverArtworkEndpointTests
{
    private Task<ApiTestHost> CreateExternalHostAsync(CoverTestDirectory root, FakeCoverProvider provider, SaveChangesInterceptor? interceptor = null)
    {
        return CreateHostAsync(root, services =>
    {
        _ = services.RemoveAll<IExternalCoverArtworkProvider>();
        _ = services.AddSingleton<IExternalCoverArtworkProvider>(provider);
        if (interceptor is not null)
        {
            _ = services.ConfigureDbContext<DiscWeaveDbContext>(options =>
            {
                _ = options.AddInterceptors(interceptor);
            });
        }
    });
    }

    private static object Selection()
    {
        return new { releaseId = FakeCoverProvider.ReleaseId, imageId = FakeCoverProvider.ImageId };
    }
    private static object OtherSelection()
    {
        return new { releaseId = Guid.Parse("d787529b-a13e-418f-ae25-aeb635d98004"), imageId = "67890" };
    }

    private static async Task<JsonElement> SelectExternalAsync(HttpClient client, string route)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(route + "/external-selection", Selection());
        return await JsonAsync(response, HttpStatusCode.OK);
    }

    private static void AssertProvenance(JsonElement artwork)
    {
        JsonElement selected = artwork.GetProperty("selected");
        Assert.Equal(JsonValueKind.Null, selected.GetProperty("sourcePath").ValueKind);
        JsonElement provenance = selected.GetProperty("provenance");
        Assert.Equal("coverArtArchive", provenance.GetProperty("provider").GetString());
        Assert.Equal(FakeCoverProvider.ReleaseId, provenance.GetProperty("releaseId").GetGuid());
        Assert.Equal(FakeCoverProvider.ImageId, provenance.GetProperty("imageId").GetString());
        Assert.Equal(64, provenance.GetProperty("sha256").GetString()?.Length);
    }

    private sealed class FakeCoverProvider : IExternalCoverArtworkProvider
    {
        public static readonly Guid ReleaseId = Guid.Parse("826f61ef-2d7f-4ecb-87e5-617119b235ac");
        public const string ImageId = "12345";
        public int Calls { get; private set; }
        public bool FailDownloads { get; set; }
        public CoverReleaseSearchQuery? Query { get; private set; }
        public bool? LastDownloadWasPreview { get; private set; }

        public Task<IReadOnlyList<CoverReleaseCandidate>> SearchReleasesAsync(CoverReleaseSearchQuery query, CancellationToken cancellationToken)
        {
            Calls++;
            Query = query;
            IReadOnlyList<CoverReleaseCandidate> items = [new(ReleaseId, "Fallen", ["Steven Julien"], $"https://musicbrainz.org/release/{ReleaseId}")
            {
                Date = "2016-07-15", Country = "GB", Formats = ["Vinyl"],
                Labels = ["Apron"], CatalogNumbers = ["AA01"], Barcode = "123456"
            }];
            return Task.FromResult(items);
        }

        public Task<IReadOnlyList<CoverArtworkCandidate>> GetFrontCoversAsync(Guid releaseId, CancellationToken cancellationToken)
        {
            Calls++;
            IReadOnlyList<CoverArtworkCandidate> items = [new(ImageId, "Front", true, ["Front"], $"https://coverartarchive.org/release/{releaseId}/{ImageId}")];
            return Task.FromResult(items);
        }

        public Task<DownloadedCoverArtwork> DownloadFrontCoverAsync(Guid releaseId, string imageId, bool preview, CancellationToken cancellationToken)
        {
            Calls++;
            LastDownloadWasPreview = preview;
            if (FailDownloads)
            {
                throw new DomainException("cover_artwork.unavailable", "Artwork provider unavailable");
            }

            byte[] bytes = FrontBytes();
            var provenance = new CoverArtworkProvenance("coverArtArchive", releaseId, imageId,
                $"https://coverartarchive.org/release/{releaseId}/{imageId}", DateTimeOffset.UtcNow, Convert.ToHexStringLower(SHA256.HashData(bytes)));
            return Task.FromResult(new DownloadedCoverArtwork(bytes, "image/png", ".png", $"external-front-{imageId}.png", provenance));
        }
    }
}
