namespace DiscWeave.Api.Features.Imports;

public sealed record ImportCoverSelectionRequest
{
    public ImportCoverSelectionRequest(Guid? candidateId)
    {
        CandidateId = candidateId;
    }

    public Guid? CandidateId { get; init; }
}
