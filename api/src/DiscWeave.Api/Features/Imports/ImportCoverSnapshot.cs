namespace DiscWeave.Api.Features.Imports;

public sealed record ImportCoverSnapshot
{
    public ImportCoverSnapshot(IReadOnlyList<ImportCoverCandidate> candidates, IReadOnlyList<string> warnings)
    {
        Candidates = candidates;
        Warnings = warnings;
    }

    public IReadOnlyList<ImportCoverCandidate> Candidates { get; init; }

    public IReadOnlyList<string> Warnings { get; init; }
}
