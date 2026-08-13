using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Tests.Imports;

public sealed partial class ExternalReleaseImportDraftTests
{
    [Theory(DisplayName = "Bound row dependency edits invalidate binding once")]
    [InlineData(ReleaseImportTrackMode.ReleaseOnly, false, false)]
    [InlineData(ReleaseImportTrackMode.Create, true, false)]
    [InlineData(ReleaseImportTrackMode.Link, false, true)]
    public void Bound_row_dependency_edits_invalidate_binding_once(
        ReleaseImportTrackMode mode,
        bool isSkipped,
        bool relink)
    {
        ReleaseImportDraft draft = ExternalDraft();
        var initialTarget = TrackId.New();
        ReleaseImportDraftTrack row = ExternalRow(draft, ReleaseImportTrackMode.Link, selectedTrackId: initialTarget);
        Initialize(draft, row);
        TrackId? selectedTrackId = mode == ReleaseImportTrackMode.Link
            ? relink ? TrackId.New() : initialTarget
            : null;

        draft.ApplyExternalTrackReviewEdit(row, EditableFields(
            row.Position,
            mode,
            selectedTrackId,
            isSkipped,
            "Reviewed title"));

        _ = Present(draft.SelectedOriginalBinding);
        Assert.False(draft.IsSelectedOriginalBindingValid);
        Assert.Equal(1, draft.ExternalReviewRevision);
    }

    [Fact(DisplayName = "Generic metadata and original edits preserve provider binding identity")]
    public void Generic_metadata_and_original_edits_preserve_provider_binding_identity()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(draft);
        Initialize(draft, row);
        SelectedOriginalBinding originalBinding = Present(draft.SelectedOriginalBinding);

        draft.ApplyExternalTrackReviewEdit(row, EditableFields(
            row.Position,
            row.TrackMode,
            row.SelectedTrackId,
            row.IsSkipped,
            "New reviewed title"));
        draft.SetExternalTrackIsOriginal(row, false);

        Assert.Same(originalBinding, Present(draft.SelectedOriginalBinding));
        Assert.False(row.IsOriginal);
        Assert.Equal(2, draft.ExternalReviewRevision);
    }

    [Fact(DisplayName = "Direct generic updates cannot bypass aggregate binding lifecycle")]
    public void Direct_generic_updates_cannot_bypass_aggregate_binding_lifecycle()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(draft);
        Initialize(draft, row);
        SelectedOriginalBinding binding = Present(draft.SelectedOriginalBinding);

        DomainException exception = Assert.Throws<DomainException>(() => row.UpdateEditableFields(
            EditableFields(row.Position, row.TrackMode, row.SelectedTrackId, row.IsSkipped, "Retarget attempt")));

        Assert.Equal("release_import.external_binding_read_only", exception.Code);
        Assert.Same(binding, Present(draft.SelectedOriginalBinding));
        Assert.Equal(0, draft.ExternalReviewRevision);
    }

    [Fact(DisplayName = "Changing the selected row position invalidates binding exactly once")]
    public void Changing_the_selected_row_position_invalidates_binding_exactly_once()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(draft);
        Initialize(draft, row);

        draft.ApplyExternalTrackReviewEdit(row, EditableFields(
            2,
            row.TrackMode,
            row.SelectedTrackId,
            row.IsSkipped,
            row.Title));

        _ = Present(draft.SelectedOriginalBinding);
        Assert.False(draft.IsSelectedOriginalBindingValid);
        Assert.Equal(1, draft.ExternalReviewRevision);
    }

    [Fact(DisplayName = "Deleting or reordering the bound row invalidates binding without retargeting")]
    public void Deleting_or_reordering_the_bound_row_invalidates_binding_without_retargeting()
    {
        ReleaseImportDraft deletedDraft = ExternalDraft();
        ReleaseImportDraftTrack deletedRow = ExternalRow(deletedDraft);
        Initialize(deletedDraft, deletedRow);
        deletedDraft.RecordExternalTrackDeleted(deletedRow);

        ReleaseImportDraft reorderedDraft = ExternalDraft();
        ReleaseImportDraftTrack reorderedRow = ExternalRow(reorderedDraft);
        Initialize(reorderedDraft, reorderedRow);
        reorderedDraft.RecordExternalTrackReordered(reorderedRow);

        _ = Present(deletedDraft.SelectedOriginalBinding);
        _ = Present(reorderedDraft.SelectedOriginalBinding);
        Assert.False(deletedDraft.IsSelectedOriginalBindingValid);
        Assert.False(reorderedDraft.IsSelectedOriginalBindingValid);
        Assert.Equal(1, deletedDraft.ExternalReviewRevision);
        Assert.Equal(1, reorderedDraft.ExternalReviewRevision);
    }

    [Fact(DisplayName = "Unrelated row edits do not invalidate selected provider identity")]
    public void Unrelated_row_edits_do_not_invalidate_selected_provider_identity()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack selected = ExternalRow(draft);
        ReleaseImportDraftTrack other = ExternalRow(draft);
        Initialize(draft, selected);
        SelectedOriginalBinding binding = Present(draft.SelectedOriginalBinding);

        draft.ApplyExternalTrackReviewEdit(other, EditableFields(
            2,
            ReleaseImportTrackMode.ReleaseOnly,
            null,
            true,
            "Other"));
        draft.RecordExternalTrackDeleted(other);
        draft.RecordExternalTrackReordered(other);
        draft.RecordExternalTrackDeleted(other);

        Assert.Same(binding, Present(draft.SelectedOriginalBinding));
        Assert.Equal(4, draft.ExternalReviewRevision);
    }

    [Fact(DisplayName = "Only authoritative rebind can replace provider identity and it keeps fixed row identities")]
    public void Only_authoritative_rebind_can_replace_provider_identity_and_it_keeps_fixed_row_identities()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(draft);
        Initialize(draft, row);
        SelectedOriginalBinding initial = Present(draft.SelectedOriginalBinding);
        SelectedOriginalBinding replacement = MusicBrainzBinding(row.Id, initial.SourceTrackId);

        draft.AuthoritativelyRebindSelectedOriginal(replacement, row);

        Assert.Same(replacement, Present(draft.SelectedOriginalBinding));
        Assert.Equal(1, draft.ExternalReviewRevision);

        SelectedOriginalBinding retargeted = MusicBrainzBinding(row.Id, TrackId.New());
        DomainException exception = Assert.Throws<DomainException>(() =>
            draft.AuthoritativelyRebindSelectedOriginal(retargeted, row));
        Assert.Equal("release_import.external_binding_source_track_read_only", exception.Code);
        Assert.Same(replacement, Present(draft.SelectedOriginalBinding));
        Assert.Equal(1, draft.ExternalReviewRevision);
    }

    [Fact(DisplayName = "Each authoritative provenance selection and clearing increments revision exactly once")]
    public void Each_authoritative_provenance_selection_and_clearing_increments_revision_exactly_once()
    {
        ReleaseImportDraft draft = ExternalDraft();

        draft.AuthoritativelySelectLocalRelease(ReleaseId.New());
        draft.AuthoritativelySelectLocalTrack(TrackId.New());
        draft.AuthoritativelyClearLocalRelease();
        draft.AuthoritativelyClearLocalTrack();

        Assert.Equal(4, draft.ExternalReviewRevision);
        ReleaseImportLocalProvenanceSelection selection = Present(draft.LocalProvenanceSelection);
        _ = Assert.IsType<MissingOptionalValue<ReleaseId>>(selection.SelectedReleaseId);
        _ = Assert.IsType<MissingOptionalValue<TrackId>>(selection.SelectedTrackId);
    }
}
