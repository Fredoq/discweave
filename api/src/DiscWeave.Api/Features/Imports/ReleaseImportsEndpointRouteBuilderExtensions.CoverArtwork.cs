using System.Security.Cryptography;
using DiscWeave.Api.Http;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportsEndpointRouteBuilderExtensions
{
    private static async Task<IResult> GetCoverArtworkAsync(
        Guid sessionId, Guid draftId, DiscWeaveDbContext context, ICurrentCollection currentCollection,
        ImportCoverArtifactStore store, HttpResponse response, CancellationToken cancellationToken)
    {
        response.Headers.CacheControl = "no-store";
        ReleaseImportDraft? draft = await FindDraftAsync(context, currentCollection.CollectionId, sessionId, draftId, cancellationToken);
        return draft is null ? ReleaseImportDraftNotFound() : Results.Ok(await CoverArtworkResponseAsync(draft, store, cancellationToken));
    }

    private static async Task<IResult> GetSelectedCoverArtworkAsync(
        Guid sessionId, Guid draftId, DiscWeaveDbContext context, ICurrentCollection currentCollection,
        HttpResponse response, CancellationToken cancellationToken)
    {
        response.Headers.CacheControl = "no-store";
        response.Headers.XContentTypeOptions = "nosniff";
        ReleaseImportDraft? draft = await FindDraftAsync(context, currentCollection.CollectionId, sessionId, draftId, cancellationToken);
        return draft?.CoverContent is { Length: > 0 } content && CoverMimeType(draft.CoverExtension) is { } contentType
            ? Results.File(content, contentType)
            : EndpointErrors.NotFound("release_import.cover_not_found", "Import cover was not found");
    }

    private static async Task<IResult> GetCandidateCoverArtworkAsync(
        Guid sessionId, Guid draftId, Guid candidateId, [AsParameters] ImportCoverEndpointServices services,
        HttpResponse response, CancellationToken cancellationToken)
    {
        DiscWeaveDbContext context = services.Context;
        ICurrentCollection currentCollection = services.CurrentCollection;
        ImportCoverArtifactStore store = services.Store;
        response.Headers.CacheControl = "no-store";
        response.Headers.XContentTypeOptions = "nosniff";
        ReleaseImportDraft? draft = await FindDraftAsync(context, currentCollection.CollectionId, sessionId, draftId, cancellationToken);
        if (draft is null)
        {
            return ReleaseImportDraftNotFound();
        }

        try
        {
            ImportCoverSnapshot snapshot = await store.ReadAsync(draft, cancellationToken);
            ImportCoverCandidate? candidate = snapshot.Candidates.FirstOrDefault(item => item.Id == candidateId);
            if (candidate is null)
            {
                return EndpointErrors.NotFound("release_import.cover_not_found", "Import cover was not found");
            }

            byte[] content = await store.ReadImageAsync(draft, candidate, cancellationToken);
            return Results.File(content, candidate.ContentType);
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
    }

    private static async Task<IResult> SelectCoverArtworkAsync(
        Guid sessionId, Guid draftId, ImportCoverSelectionRequest request, DiscWeaveDbContext context,
        ICurrentCollection currentCollection, ImportCoverArtifactStore store, CancellationToken cancellationToken)
    {
        await using IAsyncDisposable mutationLock = await ReleaseImportConfirmationService.AcquireDraftMutationLockAsync(
            currentCollection.CollectionId, sessionId, draftId, cancellationToken);
        ReleaseImportDraft? draft = await FindDraftAsync(context, currentCollection.CollectionId, sessionId, draftId, cancellationToken);
        if (draft is null)
        {
            return ReleaseImportDraftNotFound();
        }

        try
        {
            if (request.CandidateId is { } candidateId)
            {
                ImportCoverSnapshot snapshot = await store.ReadAsync(draft, cancellationToken);
                ImportCoverCandidate? candidate = snapshot.Candidates.FirstOrDefault(item => item.Id == candidateId);
                if (candidate is null)
                {
                    return EndpointErrors.NotFound("release_import.cover_not_found", "Import cover was not found");
                }

                byte[] content = await store.ReadImageAsync(draft, candidate, cancellationToken);
                SelectCandidate(draft, candidate, content);
            }
            else
            {
                draft.RemoveLocalCover();
            }

            _ = await context.SaveChangesAsync(cancellationToken);
            return Results.Ok(await CoverArtworkResponseAsync(draft, store, cancellationToken));
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
    }

    private static async Task<IResult> UploadCoverArtworkAsync(
        Guid sessionId, Guid draftId, HttpRequest request, DiscWeaveDbContext context,
        ICurrentCollection currentCollection, ImportCoverArtifactStore store, CancellationToken cancellationToken)
    {
        await using IAsyncDisposable mutationLock = await ReleaseImportConfirmationService.AcquireDraftMutationLockAsync(
            currentCollection.CollectionId, sessionId, draftId, cancellationToken);
        ReleaseImportDraft? draft = await FindDraftAsync(context, currentCollection.CollectionId, sessionId, draftId, cancellationToken);
        if (draft is null)
        {
            return ReleaseImportDraftNotFound();
        }

        try
        {
            if (!CanEditCover(draft))
            {
                return EndpointErrors.BadRequest("release_import.draft_not_editable", "Import cover cannot be changed in this draft");
            }

            if (!request.HasFormContentType)
            {
                return EndpointErrors.BadRequest("release_import.cover_form_invalid", "Upload a cover using multipart form data");
            }

            IFormCollection form = await request.ReadFormAsync(cancellationToken);
            IFormFile? file = form.Files.Count == 1 && form.Files.GetFiles("file").Count == 1 ? form.Files.GetFile("file") : null;
            if (file is null || file.Length is <= 0 or > ImportCoverValidation.MaximumBytes)
            {
                return EndpointErrors.BadRequest("release_import.cover_size_invalid", "Upload exactly one nonempty file of 10 MiB or smaller");
            }

            await using Stream stream = file.OpenReadStream();
            using var buffer = new MemoryStream((int)file.Length);
            await stream.CopyToAsync(buffer, cancellationToken);
            byte[] content = buffer.ToArray();
            string fileName = Path.GetFileName(file.FileName.Replace('\\', '/'));
            if (fileName.Length > 512)
            {
                return EndpointErrors.BadRequest("release_import.cover_name_invalid", "Cover filename is too long");
            }

            string extension = ImportCoverValidation.Validate(fileName, file.ContentType, content);
            var candidate = new ImportCoverCandidate(Guid.CreateVersion7(), fileName, extension, file.ContentType, null, content.LongLength, Convert.ToHexString(SHA256.HashData(content)));
            _ = await store.AddAsync(draft, candidate, content, cancellationToken);
            SelectCandidate(draft, candidate, content);
            _ = await context.SaveChangesAsync(cancellationToken);
            return Results.Ok(await CoverArtworkResponseAsync(draft, store, cancellationToken));
        }
        catch (InvalidDataException)
        {
            return EndpointErrors.BadRequest("release_import.cover_form_invalid", "Cover upload form is invalid");
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
    }

    private static void SelectCandidate(ReleaseImportDraft draft, ImportCoverCandidate candidate, byte[] content)
    {
        _ = ImportCoverValidation.Validate(candidate.FileName, candidate.ContentType, content);
        draft.SelectLocalCover(new ReleaseImportCoverArtifact(candidate.FileName, candidate.Extension,
            candidate.ContentType, content.LongLength, content), ToOptional(candidate.SourcePath));
    }

    private static string? CoverMimeType(string? extension)
    {
        return extension?.ToLowerInvariant() switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            _ => null
        };
    }

    private static bool CanEditCover(ReleaseImportDraft draft)
    {
        return draft.SourceKind == ReleaseImportSourceKind.LocalFiles &&
            draft.Status is ReleaseImportDraftStatus.NeedsReview or ReleaseImportDraftStatus.Ready;
    }

    private static async Task<ImportCoverArtworkResponse> CoverArtworkResponseAsync(
        ReleaseImportDraft draft, ImportCoverArtifactStore store, CancellationToken cancellationToken)
    {
        ImportCoverSnapshot snapshot = await store.ReadAsync(draft, cancellationToken);
        string url = $"/api/imports/{draft.SessionId.Value}/drafts/{draft.Id.Value}/cover-artwork";
        ImportCoverImageResponse? selected = null;
        if (draft.CoverContent is { Length: > 0 } content)
        {
            Guid? candidateId = snapshot.Candidates.FirstOrDefault(item =>
                item.FileName == draft.CoverFileName && item.Version == Convert.ToHexString(SHA256.HashData(content)))?.Id;
            selected = new ImportCoverImageResponse(candidateId, draft.CoverFileName ?? "Cover", draft.CoverContentType ?? "application/octet-stream",
                content.LongLength, $"{url}/image?v={Convert.ToHexString(SHA256.HashData(content))}", draft.CoverPath, await store.ReadProvenanceAsync(draft, cancellationToken));
        }

        IReadOnlyList<string> warnings = selected is null && !string.IsNullOrWhiteSpace(draft.CoverPath)
            ? [.. snapshot.Warnings, "This older draft still references a source image; upload an image or choose No cover to remove that dependency"]
            : snapshot.Warnings;
        return new ImportCoverArtworkResponse(selected,
            [.. snapshot.Candidates.Select(item => new ImportCoverImageResponse(item.Id, item.FileName, item.ContentType,
                item.SizeBytes, $"{url}/candidates/{item.Id}", item.SourcePath))], CanEditCover(draft), warnings);
    }
}
