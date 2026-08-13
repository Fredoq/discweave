using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ExternalReleaseDraftService
{
    private Task<ReleaseImportSession?> FindIdempotentSessionAsync(
        CollectionId collectionId,
        string idempotencyKey,
        CancellationToken cancellationToken)
    {
        return _context.ReleaseImportSessions.SingleOrDefaultAsync(
            session =>
                session.CollectionId == collectionId &&
                session.SourceKind == ReleaseImportSourceKind.ExternalMetadata &&
                EF.Property<string?>(session, "_idempotencyKey") == idempotencyKey,
            cancellationToken);
    }

    private static ReleaseImportSession EnsureIdempotencyReplay(
        ReleaseImportSession session,
        string fingerprint)
    {
        string? existingFingerprint = session.IdempotencyRequestFingerprint is PresentOptionalValue<string> present
            ? present.Value
            : null;
        return string.Equals(existingFingerprint, fingerprint, StringComparison.OrdinalIgnoreCase)
            ? session
            : throw new DomainException(
                "release_import.idempotency_key_reused",
                "The idempotency key was already used for a different request");
    }
}
