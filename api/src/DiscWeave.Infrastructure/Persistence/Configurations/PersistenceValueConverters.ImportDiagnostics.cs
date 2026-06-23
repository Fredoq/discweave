using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace DiscWeave.Infrastructure.Persistence.Configurations;

internal static partial class PersistenceValueConverters
{
    public static readonly ValueConverter<ReleaseImportScanDiagnosticId, Guid> ReleaseImportScanDiagnosticId = new(
        id => id.Value,
        value => new ReleaseImportScanDiagnosticId(value));

    public static readonly ValueConverter<ReleaseImportLooseFileCandidateId, Guid> ReleaseImportLooseFileCandidateId = new(
        id => id.Value,
        value => new ReleaseImportLooseFileCandidateId(value));

    public static readonly ValueConverter<ReleaseImportDraftId?, Guid?> NullableReleaseImportDraftId = new(
        id => id.HasValue ? id.Value.Value : null,
        value => value.HasValue ? new ReleaseImportDraftId(value.Value) : null);
}
