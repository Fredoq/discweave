namespace DiscWeave.Api.Features.Imports;

public sealed record ImportCoverArtworkResponse
{
    public ImportCoverArtworkResponse(ImportCoverImageResponse? selected, IReadOnlyList<ImportCoverImageResponse> candidates, bool canEdit, IReadOnlyList<string> warnings)
    {
        Selected = selected;
        Candidates = candidates;
        CanEdit = canEdit;
        Warnings = warnings;
    }

    public ImportCoverImageResponse? Selected { get; init; }

    public IReadOnlyList<ImportCoverImageResponse> Candidates { get; init; }

    public bool CanEdit { get; init; }

    public IReadOnlyList<string> Warnings { get; init; }
}
