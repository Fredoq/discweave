namespace DiscWeave.Domain.SharedKernel.Ids;

public readonly record struct ReleaseImportScanDiagnosticId(Guid Value)
{
    public static ReleaseImportScanDiagnosticId New()
    {
        return new ReleaseImportScanDiagnosticId(Guid.CreateVersion7());
    }

    public override string ToString()
    {
        return Value.ToString();
    }
}
