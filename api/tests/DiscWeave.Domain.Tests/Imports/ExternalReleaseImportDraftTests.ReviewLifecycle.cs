using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Tests.Imports;

public sealed partial class ExternalReleaseImportDraftTests
{
    [Fact(DisplayName = "External row direct semantic no-op is allowed after materialization")]
    public void External_row_direct_semantic_no_op_is_allowed_after_materialization()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(draft);

        row.UpdateEditableFields(EditableFields(
            row.Position,
            row.TrackMode,
            row.SelectedTrackId,
            row.IsSkipped,
            $" {row.Title} "));

        Assert.Equal("Original", row.Title);
        Assert.Equal(TimeSpan.FromMinutes(3), row.Duration);
        Assert.Equal(1994, row.VersionYear);
    }

    [Fact(DisplayName = "External row direct edits are rejected before binding and after reconstruction")]
    public void External_row_direct_edits_are_rejected_before_binding_and_after_reconstruction()
    {
        ReleaseImportDraft draft = ExternalDraft();
        var row = ReleaseImportDraftTrack.CreateExternalMetadata(
            draft.CollectionId,
            draft.Id,
            ReleaseImportDraftTrackId.New());

        DomainException exception = Assert.Throws<DomainException>(() => row.UpdateEditableFields(
            EditableFields(1, ReleaseImportTrackMode.Create, null, false, "Direct edit")));

        Assert.Equal("release_import.external_binding_read_only", exception.Code);
        Assert.Equal(string.Empty, row.Title);
    }

    [Fact(DisplayName = "Failed external row edit is exception atomic")]
    public void Failed_external_row_edit_is_exception_atomic()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(draft);
        Initialize(draft, row);
        SelectedOriginalBinding binding = Present(draft.SelectedOriginalBinding);

        DomainException exception = Assert.Throws<DomainException>(() => draft.ApplyExternalTrackReviewEdit(
            row,
            EditableFields(2, ReleaseImportTrackMode.ReleaseOnly, null, true, " ")));

        Assert.Equal("release_import.track_title_required", exception.Code);
        Assert.Equal(1, row.Position);
        Assert.Equal(ReleaseImportTrackMode.Create, row.TrackMode);
        Assert.False(row.IsSkipped);
        Assert.Equal("Original", row.Title);
        Assert.Same(binding, Present(draft.SelectedOriginalBinding));
        Assert.True(draft.IsSelectedOriginalBindingValid);
        Assert.Equal(0, draft.ExternalReviewRevision);
    }

    [Fact(DisplayName = "Invalidated binding keeps stable identities and authoritative rebind restores validity")]
    public void Invalidated_binding_keeps_stable_identities_and_authoritative_rebind_restores_validity()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(draft);
        Initialize(draft, row);
        SelectedOriginalBinding original = Present(draft.SelectedOriginalBinding);

        draft.ApplyExternalTrackReviewEdit(
            row,
            EditableFields(row.Position, ReleaseImportTrackMode.ReleaseOnly, null, false, row.Title));

        Assert.Same(original, Present(draft.SelectedOriginalBinding));
        Assert.False(draft.IsSelectedOriginalBindingValid);
        Assert.Equal(1, draft.ExternalReviewRevision);
        Assert.Equal(
            "release_import.external_binding_read_only",
            Assert.Throws<DomainException>(() => draft.InitializeExternalReview(
                MusicBrainzBinding(row.Id, original.SourceTrackId),
                ReleaseImportCollectionItemIntent.NewWanted.WithMedium(ReleaseImportMediumIntent.Digital.Create()),
                row)).Code);

        draft.ApplyExternalTrackReviewEdit(
            row,
            EditableFields(row.Position, ReleaseImportTrackMode.Create, null, false, row.Title));
        SelectedOriginalBinding replacement = MusicBrainzBinding(row.Id, original.SourceTrackId);
        draft.AuthoritativelyRebindSelectedOriginal(replacement, row);

        Assert.True(draft.IsSelectedOriginalBindingValid);
        Assert.Equal(original.SourceTrackId, Present(draft.SelectedOriginalBinding).SourceTrackId);
        Assert.Equal(original.DraftTrackId, Present(draft.SelectedOriginalBinding).DraftTrackId);
        Assert.Equal(3, draft.ExternalReviewRevision);
    }

    [Fact(DisplayName = "Retargeted linked row requires fresh promotion confirmation after authoritative rebind")]
    public void Retargeted_linked_row_requires_fresh_promotion_confirmation_after_authoritative_rebind()
    {
        var targetA = TrackId.New();
        var targetB = TrackId.New();
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(
            draft,
            ReleaseImportTrackMode.Link,
            selectedTrackId: targetA);
        Initialize(draft, row);
        SelectedOriginalBinding binding = Present(draft.SelectedOriginalBinding);
        ReleaseImportRelationSuggestion relation = RejectedRequiredSuggestion(draft, row);
        draft.SetLinkedTargetPromotionConfirmation(row, true);

        draft.ApplyExternalTrackReviewEdit(
            row,
            EditableFields(row.Position, ReleaseImportTrackMode.Link, targetB, false, row.Title));

        Assert.False(draft.IsSelectedOriginalBindingValid);
        Assert.False(Present(draft.SelectedOriginalBinding).PromoteLinkedTargetConfirmed);

        draft.AuthoritativelyRebindSelectedOriginal(
            MusicBrainzBinding(row.Id, binding.SourceTrackId, promoteLinkedTargetConfirmed: true),
            row);

        Assert.True(draft.IsSelectedOriginalBindingValid);
        Assert.False(Present(draft.SelectedOriginalBinding).PromoteLinkedTargetConfirmed);
        Assert.False(draft.IsExternalConfirmationReady(row, relation, null, linkedTargetIsStandalone: true));

        draft.SetLinkedTargetPromotionConfirmation(row, true);

        Assert.True(draft.IsExternalConfirmationReady(row, relation, null, linkedTargetIsStandalone: true));
        Assert.Equal(4, draft.ExternalReviewRevision);
    }

    [Fact(DisplayName = "Every invalid dependency edit clears provenance before authoritative rebind")]
    public void Every_invalid_dependency_edit_clears_provenance_before_authoritative_rebind()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(draft);
        Initialize(draft, row);
        SelectedOriginalBinding binding = Present(draft.SelectedOriginalBinding);

        draft.ApplyExternalTrackReviewEdit(
            row,
            EditableFields(2, row.TrackMode, row.SelectedTrackId, row.IsSkipped, row.Title));
        draft.AuthoritativelySelectLocalRelease(ReleaseId.New());
        draft.AuthoritativelySelectLocalTrack(TrackId.New());

        long revisionBeforeSecondEdit = draft.ExternalReviewRevision;
        draft.ApplyExternalTrackReviewEdit(
            row,
            EditableFields(3, row.TrackMode, row.SelectedTrackId, row.IsSkipped, row.Title));

        Assert.Equal(revisionBeforeSecondEdit + 1, draft.ExternalReviewRevision);
        Assert.False(draft.IsSelectedOriginalBindingValid);
        AssertLocalProvenanceIsEmpty(draft);

        draft.AuthoritativelyRebindSelectedOriginal(
            MusicBrainzBinding(row.Id, binding.SourceTrackId, promoteLinkedTargetConfirmed: true),
            row);

        Assert.True(draft.IsSelectedOriginalBindingValid);
        Assert.False(Present(draft.SelectedOriginalBinding).PromoteLinkedTargetConfirmed);
        AssertLocalProvenanceIsEmpty(draft);
    }

    [Fact(DisplayName = "External review changes increment once and semantic no-ops are revision neutral")]
    public void External_review_changes_increment_once_and_semantic_no_ops_are_revision_neutral()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(draft);
        Initialize(draft, row);
        SelectedOriginalBinding original = Present(draft.SelectedOriginalBinding);
        var digitalWanted = ReleaseImportCollectionItemIntent.NewWanted.WithMedium(
            ReleaseImportMediumIntent.Digital.Create());

        draft.SetExternalCollectionItemIntent(digitalWanted);
        draft.SetExternalTrackIsOriginal(row, true);
        draft.AuthoritativelyRebindSelectedOriginal(original, row);
        Assert.Equal(0, draft.ExternalReviewRevision);

        draft.SetExternalCollectionItemIntent(ReleaseImportCollectionItemIntent.NewWanted.WithMedium(
            ReleaseImportMediumIntent.Vinyl.Create("LP")));
        draft.SetExternalCollectionItemIntent(ReleaseImportCollectionItemIntent.NewWanted.WithMedium(
            ReleaseImportMediumIntent.Vinyl.Create("LP")));
        Assert.Equal(1, draft.ExternalReviewRevision);

        var releaseId = ReleaseId.New();
        draft.AuthoritativelySelectLocalRelease(releaseId);
        draft.AuthoritativelySelectLocalRelease(releaseId);
        draft.AuthoritativelyClearLocalRelease();
        draft.AuthoritativelyClearLocalRelease();
        Assert.Equal(3, draft.ExternalReviewRevision);

        draft.SetExternalTrackIsOriginal(row, false);
        draft.SetExternalTrackIsOriginal(row, false);
        Assert.Equal(4, draft.ExternalReviewRevision);

        SelectedOriginalBinding replacement = MusicBrainzBinding(row.Id, original.SourceTrackId);
        draft.AuthoritativelyRebindSelectedOriginal(replacement, row);
        draft.AuthoritativelyRebindSelectedOriginal(replacement, row);
        Assert.Equal(5, draft.ExternalReviewRevision);
    }

    [Fact(DisplayName = "Direct original mutation is blocked for external rows but remains available for local rows")]
    public void Direct_original_mutation_is_blocked_for_external_rows_but_remains_available_for_local_rows()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack externalRow = ExternalRow(draft);
        ReleaseImportDraftTrack localRow = LocalRow(
            draft.CollectionId,
            draft.Id,
            ReleaseImportDraftTrackId.New());

        DomainException exception = Assert.Throws<DomainException>(() => externalRow.SetIsOriginal(true));
        localRow.SetIsOriginal(true);

        Assert.Equal("release_import.external_binding_read_only", exception.Code);
        Assert.False(externalRow.IsOriginal);
        Assert.True(localRow.IsOriginal);
    }

    private static ReleaseImportDraftTrack LocalRow(
        CollectionId collectionId,
        ReleaseImportDraftId draftId,
        ReleaseImportDraftTrackId rowId)
    {
        var file = new DraftTrackFileInfo(
            "/music/01.flac",
            "01.flac",
            AudioFileFormat.Flac,
            1,
            DateTimeOffset.UnixEpoch,
            Optional.Missing<string>(),
            DraftTrackFileMetadata.Empty);
        return ReleaseImportDraftTrack.Create(collectionId, draftId, rowId, file);
    }

    private static void AssertLocalProvenanceIsEmpty(ReleaseImportDraft draft)
    {
        ReleaseImportLocalProvenanceSelection selection = Present(draft.LocalProvenanceSelection);
        _ = Assert.IsType<MissingOptionalValue<ReleaseId>>(selection.SelectedReleaseId);
        _ = Assert.IsType<MissingOptionalValue<TrackId>>(selection.SelectedTrackId);
    }
}
