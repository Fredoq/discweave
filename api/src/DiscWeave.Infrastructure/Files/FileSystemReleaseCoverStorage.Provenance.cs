using System.Text.Json;
using DiscWeave.Application.Catalog.CoverArtwork;

namespace DiscWeave.Infrastructure.Files;

public sealed partial class FileSystemReleaseCoverStorage : IReleaseCoverProvenanceStorage
{
    public async Task SaveAsync(string storageKey, CoverArtworkProvenance provenance, CancellationToken cancellationToken)
    {
        string path = ResolvePath(storageKey) + ".provenance.json";
        string temporary = path + $".{Guid.CreateVersion7():N}.tmp";
        try
        {
            await File.WriteAllTextAsync(temporary, JsonSerializer.Serialize(provenance), cancellationToken);
            File.Move(temporary, path, overwrite: true);
        }
        finally
        {
            if (File.Exists(temporary))
            {
                File.Delete(temporary);
            }
        }
    }

    public async Task<CoverArtworkProvenance?> ReadAsync(string storageKey, CancellationToken cancellationToken)
    {
        string path = ResolvePath(storageKey) + ".provenance.json";
        return File.Exists(path)
            ? JsonSerializer.Deserialize<CoverArtworkProvenance>(await File.ReadAllTextAsync(path, cancellationToken))
            : null;
    }
}
