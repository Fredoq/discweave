using System.Security.Cryptography;
using System.Text.Json;
using DiscWeave.Application.Catalog.CoverArtwork;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ImportCoverArtifactStore
{
    public Task SaveProvenanceAsync(ReleaseImportDraft draft, CoverArtworkProvenance provenance, CancellationToken cancellationToken)
    {
        return WriteProvenanceAsync(draft, provenance.Sha256, JsonSerializer.SerializeToUtf8Bytes(provenance), cancellationToken);
    }

    public async Task<byte[]?> ReadProvenanceBytesAsync(ReleaseImportDraft draft, string hash, CancellationToken cancellationToken)
    {
        string path = ProvenancePath(draft, hash);
        if (!File.Exists(path))
        {
            return null;
        }

        long length = new FileInfo(path).Length;
        if (length > 64 * 1024)
        {
            throw new DomainException("release_import.cover_provenance_invalid", "Stored cover provenance exceeds the supported size");
        }

        byte[] content = new byte[(int)length];
        await using FileStream stream = File.OpenRead(path);
        await stream.ReadExactlyAsync(content, cancellationToken);
        return content;
    }

    public async Task WriteProvenanceAsync(ReleaseImportDraft draft, string hash, byte[]? content, CancellationToken cancellationToken)
    {
        string path = ProvenancePath(draft, hash);
        if (content is null)
        {
            File.Delete(path);
            return;
        }

        _ = Directory.CreateDirectory(DraftDirectory(draft));
        string temporary = path + $".{Guid.CreateVersion7():N}.tmp";
        try
        {
            await File.WriteAllBytesAsync(temporary, content, cancellationToken);
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

    public async Task<CoverArtworkProvenance?> ReadProvenanceAsync(ReleaseImportDraft draft, CancellationToken cancellationToken)
    {
        if (draft.CoverContent is not { Length: > 0 } content)
        {
            return null;
        }

        string hash = Convert.ToHexString(SHA256.HashData(content));
        byte[]? bytes = await ReadProvenanceBytesAsync(draft, hash, cancellationToken);
        CoverArtworkProvenance? provenance = bytes is null ? null : JsonSerializer.Deserialize<CoverArtworkProvenance>(bytes);
        return string.Equals(provenance?.Sha256, hash, StringComparison.OrdinalIgnoreCase) ? provenance : null;
    }

    private string ProvenancePath(ReleaseImportDraft draft, string hash)
    {
        return hash.Length != 64 || !hash.All(char.IsAsciiHexDigit)
            ? throw new DomainException("release_import.cover_provenance_invalid", "Cover provenance requires a SHA-256 content hash")
            : Path.Combine(DraftDirectory(draft), $"{hash.ToUpperInvariant()}.provenance.json");
    }
}
