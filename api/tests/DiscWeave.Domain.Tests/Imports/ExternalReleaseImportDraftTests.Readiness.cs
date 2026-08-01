using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Tests.Imports;

public sealed partial class ExternalReleaseImportDraftTests
{
    [Fact(DisplayName = "Confirmation readiness requires exact owned Required relation endpoints")]
    public void Confirmation_readiness_requires_exact_owned_required_relation_endpoints()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(draft);
        Initialize(draft, row);
        SelectedOriginalBinding binding = Present(draft.SelectedOriginalBinding);
        ReleaseImportRelationSuggestion exact = RejectedRequiredSuggestion(draft, row);

        ReleaseImportRelationSuggestion[] invalidRelations =
        [
            ReleaseImportRelationSuggestion.Create(
                draft.CollectionId,
                draft.SessionId,
                draft.Id,
                ReleaseImportRelationSuggestionId.New(),
                "best-effort",
                100,
                exact.ReviewedPayload),
            RequiredRelation(
                CollectionId.New(), draft.SessionId, draft.Id, binding.SourceTrackId, row.Id),
            RequiredRelation(
                draft.CollectionId, ReleaseImportSessionId.New(), draft.Id, binding.SourceTrackId, row.Id),
            RequiredRelation(
                draft.CollectionId, draft.SessionId, ReleaseImportDraftId.New(), binding.SourceTrackId, row.Id),
            RequiredRelation(
                draft.CollectionId, draft.SessionId, draft.Id, TrackId.New(), row.Id),
            RequiredRelation(
                draft.CollectionId, draft.SessionId, draft.Id, binding.SourceTrackId, ReleaseImportDraftTrackId.New())
        ];
        foreach (ReleaseImportRelationSuggestion relation in invalidRelations)
        {
            relation.Reject();
        }

        Assert.False(draft.IsExternalConfirmationReady(row, null, null, false));
        Assert.All(invalidRelations, relation =>
            Assert.False(draft.IsExternalConfirmationReady(row, relation, null, false)));
        Assert.True(draft.IsExternalConfirmationReady(row, exact, null, false));
    }

    [Fact(DisplayName = "Confirmation readiness rejects local rows even with matching aggregate IDs")]
    public void Confirmation_readiness_rejects_local_rows_even_with_matching_aggregate_ids()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack externalRow = ExternalRow(draft);
        Initialize(draft, externalRow);
        ReleaseImportDraftTrack localRow = LocalRow(draft.CollectionId, draft.Id, externalRow.Id);

        Assert.False(draft.IsExternalConfirmationReady(
            localRow,
            RejectedRequiredSuggestion(draft, externalRow),
            null,
            false));
    }

    [Fact(DisplayName = "Invalid binding is never confirmation ready")]
    public void Invalid_binding_is_never_confirmation_ready()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(draft);
        Initialize(draft, row);
        ReleaseImportRelationSuggestion relation = RejectedRequiredSuggestion(draft, row);

        draft.RecordExternalTrackReordered(row);

        Assert.False(draft.IsExternalConfirmationReady(row, relation, null, false));
    }

    private static ReleaseImportRelationSuggestion RequiredRelation(
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportDraftId draftId,
        TrackId sourceTrackId,
        ReleaseImportDraftTrackId targetTrackId)
    {
        return ReleaseImportRelationSuggestion.CreateRequired(
            collectionId,
            sessionId,
            draftId,
            ReleaseImportRelationSuggestionId.New(),
            "original-discovery",
            100,
            new ReleaseImportRelationSuggestionPayload(
                ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(sourceTrackId),
                ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(targetTrackId),
                "versionOf"));
    }
}
