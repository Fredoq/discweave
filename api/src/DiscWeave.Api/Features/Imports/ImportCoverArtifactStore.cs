using System.Security.Cryptography;
using System.Text.Json;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Files;
using Microsoft.Extensions.Options;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ImportCoverArtifactStore
{
    private const int MaximumCandidates = 32;
    private const long MaximumSnapshotBytes = 64 * 1024 * 1024;
    private const long MaximumJsonBytes = 256 * 1024;
    private readonly string _root;

    public ImportCoverArtifactStore(IOptions<ReleaseCoverStorageOptions> options, IOptions<ImportCoverStorageOptions> importOptions)
    {
        string? coverRoot = options.Value.StorageRoot;
        _root = !string.IsNullOrWhiteSpace(importOptions.Value.StorageRoot)
            ? Path.GetFullPath(importOptions.Value.StorageRoot)
            : Path.Combine(string.IsNullOrWhiteSpace(coverRoot) ? AppContext.BaseDirectory : Path.GetFullPath(coverRoot), "import-candidates");
    }

    public async Task<ImportCoverSnapshot> ReadAsync(ReleaseImportDraft draft, CancellationToken cancellationToken)
    {
        string path = SnapshotPath(draft);
        if (!File.Exists(path))
        {
            return new ImportCoverSnapshot([], []);
        }

        if (new FileInfo(path).Length > MaximumJsonBytes)
        {
            throw new DomainException("release_import.cover_artifacts_invalid", "Stored cover candidates exceed the supported size");
        }

        await using FileStream stream = File.OpenRead(path);
        try
        {
            return await JsonSerializer.DeserializeAsync<ImportCoverSnapshot>(stream, cancellationToken: cancellationToken)
                ?? new ImportCoverSnapshot([], []);
        }
        catch (JsonException)
        {
            throw new DomainException("release_import.cover_artifacts_invalid", "Stored cover candidates could not be read");
        }
    }

    public async Task CaptureAsync(ReleaseImportDraft draft, DesktopFolderScanRequest request, CancellationToken cancellationToken)
    {
        if (draft.SourceKind != ReleaseImportSourceKind.LocalFiles)
        {
            return;
        }

        string relativeRoot = draft.RelativePath is PresentOptionalValue<string> relativePath ? relativePath.Value.Replace('\\', '/').Trim('/') : string.Empty;
        List<ImportCoverCandidate> candidates = [];
        List<string> warnings = [];
        long total = 0;
        bool namesOnly = string.Equals(request.ScanMode?.Trim(), "namesOnly", StringComparison.OrdinalIgnoreCase);
        foreach (DesktopFolderScanFileRequest file in request.Files ?? [])
        {
            if (file is null || string.IsNullOrWhiteSpace(file.RelativePath) || namesOnly)
            {
                continue;
            }

            string relative = file.RelativePath.Replace('\\', '/');
            string directory = (Path.GetDirectoryName(relative) ?? string.Empty).Replace('\\', '/').Trim('/');
            if (!string.Equals(directory, relativeRoot, StringComparison.OrdinalIgnoreCase) || file.AudioMetadata is not null || file.Format is not null || file.CoverArtifact is not { } artifact)
            {
                continue;
            }

            try
            {
                string fileName = Path.GetFileName((artifact.FileName ?? string.Empty).Replace('\\', '/'));
                if (fileName.Length is 0 or > 512 || file.FilePath?.Length > 4096 || string.IsNullOrWhiteSpace(artifact.ContentBase64) || artifact.ContentBase64.Length > 14 * 1024 * 1024)
                {
                    throw new DomainException("release_import.cover_invalid", "Image metadata or content exceeds supported bounds");
                }

                byte[] content = Convert.FromBase64String(artifact.ContentBase64);
                if (artifact.SizeBytes != content.LongLength)
                {
                    throw new DomainException("release_import.cover_invalid", "Image size does not match its stored bytes");
                }

                string extension = ImportCoverValidation.Validate(fileName, artifact.ContentType, content);
                if (candidates.Count >= MaximumCandidates || total + content.LongLength > MaximumSnapshotBytes)
                {
                    AddWarning(warnings, "Some cover candidates exceed the import preview budget; upload the desired image separately");
                    break;
                }

                var candidate = new ImportCoverCandidate(Guid.CreateVersion7(), fileName, extension, artifact.ContentType,
                    file.FilePath, content.LongLength, Convert.ToHexString(SHA256.HashData(content)));
                await WriteImageAsync(draft, candidate, content, cancellationToken);
                candidates.Add(candidate);
                total += content.LongLength;
            }
            catch (FormatException)
            {
                AddWarning(warnings, "An invalid image encoding was skipped");
            }
            catch (DomainException exception)
            {
                string name = Path.GetFileName(relative);
                AddWarning(warnings, $"{name[..Math.Min(name.Length, 120)]}: {exception.Message}");
            }
        }

        if (namesOnly)
        {
            AddWarning(warnings, "Names-only scans do not read cover image content; upload an image to attach a cover");
            draft.RemoveLocalCover();
        }
        else if (draft.CoverContent is not { Length: > 0 and <= ImportCoverValidation.MaximumBytes })
        {
            // A managed scan never falls back to reading an original source file during confirmation.
            draft.RemoveLocalCover();
        }

        await WriteAsync(draft, new ImportCoverSnapshot(candidates, warnings), cancellationToken);
    }

    public async Task<bool> AddAsync(ReleaseImportDraft draft, ImportCoverCandidate candidate, byte[] content, CancellationToken cancellationToken)
    {
        ImportCoverSnapshot snapshot = await ReadAsync(draft, cancellationToken);
        if (snapshot.Candidates.Count >= MaximumCandidates || snapshot.Candidates.Sum(item => item.SizeBytes) + content.LongLength > MaximumSnapshotBytes)
        {
            return false;
        }

        await WriteImageAsync(draft, candidate, content, cancellationToken);
        await WriteAsync(draft, new ImportCoverSnapshot([.. snapshot.Candidates, candidate], snapshot.Warnings), cancellationToken);
        return true;
    }

    public void DeleteSession(CollectionId collectionId, Guid sessionId)
    {
        string path = Path.Combine(_root, collectionId.Value.ToString("N"), sessionId.ToString("N"));
        if (Directory.Exists(path))
        {
            Directory.Delete(path, recursive: true);
        }
    }

    public void DeleteDraft(ReleaseImportDraft draft)
    {
        string path = DraftDirectory(draft);
        if (Directory.Exists(path))
        {
            Directory.Delete(path, recursive: true);
        }
    }

    public async Task<byte[]> ReadImageAsync(ReleaseImportDraft draft, ImportCoverCandidate candidate, CancellationToken cancellationToken)
    {
        string path = ImagePath(draft, candidate.Id);
        if (!File.Exists(path) || new FileInfo(path).Length != candidate.SizeBytes || candidate.SizeBytes is <= 0 or > ImportCoverValidation.MaximumBytes)
        {
            throw new DomainException("release_import.cover_unavailable", "Stored cover image is unavailable");
        }

        await using FileStream stream = File.OpenRead(path);
        byte[] content = new byte[checked((int)candidate.SizeBytes)];
        try
        {
            await stream.ReadExactlyAsync(content, cancellationToken);
        }
        catch (EndOfStreamException)
        {
            throw new DomainException("release_import.cover_unavailable", "Stored cover image has changed");
        }

        byte[] extra = new byte[1];
        return await stream.ReadAsync(extra, cancellationToken) == 0 &&
            string.Equals(candidate.Version, Convert.ToHexString(SHA256.HashData(content)), StringComparison.Ordinal)
            ? content
            : throw new DomainException("release_import.cover_unavailable", "Stored cover image has changed");
    }

    private static void AddWarning(List<string> warnings, string warning)
    {
        if (warnings.Count < 16)
        {
            warnings.Add(warning);
        }
    }

    private async Task WriteImageAsync(ReleaseImportDraft draft, ImportCoverCandidate candidate, byte[] content, CancellationToken cancellationToken)
    {
        _ = Directory.CreateDirectory(DraftDirectory(draft));
        await using FileStream stream = new(ImagePath(draft, candidate.Id), FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, true);
        await stream.WriteAsync(content, cancellationToken);
    }

    private string DraftDirectory(ReleaseImportDraft draft) => Path.Combine(_root,
        draft.CollectionId.Value.ToString("N"), draft.SessionId.Value.ToString("N"), draft.Id.Value.ToString("N"));

    private string ImagePath(ReleaseImportDraft draft, Guid candidateId) => Path.Combine(DraftDirectory(draft), $"{candidateId:N}.image");

    private async Task WriteAsync(ReleaseImportDraft draft, ImportCoverSnapshot snapshot, CancellationToken cancellationToken)
    {
        string path = SnapshotPath(draft);
        _ = Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        string temporary = path + $".{Guid.CreateVersion7():N}.tmp";
        try
        {
            await using (FileStream stream = new(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, true))
            {
                await JsonSerializer.SerializeAsync(stream, snapshot, cancellationToken: cancellationToken);
            }

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

    private string SnapshotPath(ReleaseImportDraft draft) => Path.Combine(DraftDirectory(draft), "manifest.json");
}
