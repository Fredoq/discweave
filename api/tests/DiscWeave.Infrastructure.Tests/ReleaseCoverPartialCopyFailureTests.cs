using DiscWeave.Application.Catalog.Releases;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Files;
using Microsoft.Extensions.Options;

namespace DiscWeave.Infrastructure.Tests;

public sealed class ReleaseCoverPartialCopyFailureTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Failed_or_cancelled_cover_copy_removes_only_its_partial_file(bool cancel)
    {
        string root = Path.Combine(Path.GetTempPath(), $"discweave-cover-copy-{Guid.CreateVersion7():N}");
        _ = Directory.CreateDirectory(root);
        try
        {
            var storage = new FileSystemReleaseCoverStorage(Options.Create(new ReleaseCoverStorageOptions { StorageRoot = root }));
            var collectionId = new CollectionId(Guid.CreateVersion7());
            var releaseId = new ReleaseId(Guid.CreateVersion7());
            byte[] original = [1, 2, 3, 4];
            using var good = new MemoryStream(original);
            ReleaseCoverStoredFile saved = await storage.SaveAsync(collectionId, releaseId, ".png", good, CancellationToken.None);
            using var broken = new PartialFailureStream(cancel);
            if (cancel)
            {
                _ = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => storage.SaveAsync(collectionId, releaseId, ".png", broken, CancellationToken.None));
            }
            else
            {
                _ = await Assert.ThrowsAsync<IOException>(() => storage.SaveAsync(collectionId, releaseId, ".png", broken, CancellationToken.None));
            }

            Assert.True(broken.CopiedPrefix);
            string remaining = Assert.Single(Directory.GetFiles(root, "*", SearchOption.AllDirectories));
            Assert.Equal(Path.Combine(root, saved.StorageKey), remaining);
            Assert.Equal(original, await File.ReadAllBytesAsync(remaining));
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    private sealed class PartialFailureStream : MemoryStream
    {
        private readonly bool _cancel;
        public bool CopiedPrefix { get; private set; }

        public PartialFailureStream(bool cancel)
        {
            _cancel = cancel;
        }

        public override async Task CopyToAsync(Stream destination, int bufferSize, CancellationToken cancellationToken)
        {
            byte[] prefix = [5, 6, 7];
            await destination.WriteAsync(prefix, cancellationToken);
            CopiedPrefix = true;
            if (_cancel)
            {
                throw new OperationCanceledException("Simulated partial copy cancellation", new CancellationToken(canceled: true));
            }
            throw new IOException("Simulated partial copy failure");
        }
    }
}
