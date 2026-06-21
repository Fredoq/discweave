using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace DiscWeave.Infrastructure.Persistence.Configurations;

internal static partial class PersistenceValueConverters
{
    public static readonly ValueConverter<ReleaseImportScanDiagnosticId, Guid> ReleaseImportScanDiagnosticId = new(
        id => id.Value,
        value => new ReleaseImportScanDiagnosticId(value));
}
