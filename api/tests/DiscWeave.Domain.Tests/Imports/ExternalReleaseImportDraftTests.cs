using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Tests.Imports;

public sealed partial class ExternalReleaseImportDraftTests
{
    [Fact(DisplayName = "External drafts retain selected binding, Wanted intent, and independent local provenance")]
    public void External_drafts_retain_selected_binding_wanted_intent_and_independent_local_provenance()
    {
        var releaseId = ReleaseId.New();
        var trackId = TrackId.New();
        ReleaseImportDraft draft = ExternalDraft(
            ReleaseImportLocalProvenanceSelection.Empty()
                .WithRelease(releaseId)
                .WithTrack(trackId));
        ReleaseImportDraftTrack row = ExternalRow(draft);
        SelectedOriginalBinding binding = MusicBrainzBinding(row.Id);
        var intent = ReleaseImportCollectionItemIntent.NewWanted.WithMedium(
            ReleaseImportMediumIntent.Vinyl.Create(" 2xLP "));

        draft.InitializeExternalReview(binding, intent, row);

        Assert.Same(binding, Present(draft.SelectedOriginalBinding));
        Assert.Same(intent, Present(draft.CollectionItemIntent));
        Assert.Equal(releaseId, Present(draft.LocalProvenanceSelection).SelectedReleaseId.Match(value => value, ReleaseId.New));
        Assert.Equal(trackId, Present(draft.LocalProvenanceSelection).SelectedTrackId.Match(value => value, TrackId.New));
        Assert.Equal(0, draft.ExternalReviewRevision);
        Assert.True(row.IsOriginal);
        Assert.Equal("vinyl:2xLP", Present(Assert.IsType<ReleaseImportCollectionItemIntent.NewWanted>(intent).Medium).CanonicalKey);
    }

    [Fact(DisplayName = "Local-file drafts reject external review state")]
    public void Local_file_drafts_reject_external_review_state()
    {
        var draft = ReleaseImportDraft.CreateLocalFiles(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportDraftId.New(),
            "/music/release",
            "release");
        ReleaseImportDraftTrack row = ExternalRow(draft);

        DomainException bindingException = Assert.Throws<DomainException>(() => draft.InitializeExternalReview(
            MusicBrainzBinding(row.Id),
            ReleaseImportCollectionItemIntent.NewWanted.WithMedium(ReleaseImportMediumIntent.Digital.Create()),
            row));
        DomainException selectionException = Assert.Throws<DomainException>(() =>
            draft.AuthoritativelySelectLocalRelease(ReleaseId.New()));
        DomainException intentException = Assert.Throws<DomainException>(() =>
            draft.SetExternalCollectionItemIntent(ReleaseImportCollectionItemIntent.NewWanted.WithoutMedium()));

        Assert.Equal("release_import.external_metadata_required", bindingException.Code);
        Assert.Equal("release_import.external_metadata_required", selectionException.Code);
        Assert.Equal("release_import.external_metadata_required", intentException.Code);
    }

    [Fact(DisplayName = "External binding requires the exact bound editable row and usable track mode")]
    public void External_binding_requires_the_exact_bound_editable_row_and_usable_track_mode()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack wrongRow = ExternalRow(draft);
        SelectedOriginalBinding binding = MusicBrainzBinding(ReleaseImportDraftTrackId.New());

        DomainException wrongRowException = Assert.Throws<DomainException>(() => draft.InitializeExternalReview(
            binding,
            ReleaseImportCollectionItemIntent.NewWanted.WithMedium(ReleaseImportMediumIntent.Digital.Create()),
            wrongRow));

        ReleaseImportDraftTrack releaseOnlyRow = ExternalRow(draft, ReleaseImportTrackMode.ReleaseOnly);
        DomainException releaseOnlyException = Assert.Throws<DomainException>(() => draft.InitializeExternalReview(
            MusicBrainzBinding(releaseOnlyRow.Id),
            ReleaseImportCollectionItemIntent.NewWanted.WithMedium(ReleaseImportMediumIntent.Digital.Create()),
            releaseOnlyRow));

        ReleaseImportDraftTrack skippedRow = ExternalRow(draft, isSkipped: true);
        DomainException skippedException = Assert.Throws<DomainException>(() => draft.InitializeExternalReview(
            MusicBrainzBinding(skippedRow.Id),
            ReleaseImportCollectionItemIntent.NewWanted.WithMedium(ReleaseImportMediumIntent.Digital.Create()),
            skippedRow));

        Assert.Equal("release_import.external_binding_row_mismatch", wrongRowException.Code);
        Assert.Equal("release_import.external_binding_release_only", releaseOnlyException.Code);
        Assert.Equal("release_import.external_binding_row_skipped", skippedException.Code);
    }

    [Fact(DisplayName = "Only the selected external row starts as original")]
    public void Only_the_selected_external_row_starts_as_original()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack selected = ExternalRow(draft);
        ReleaseImportDraftTrack other = ExternalRow(draft);

        draft.InitializeExternalReview(
            MusicBrainzBinding(selected.Id),
            ReleaseImportCollectionItemIntent.NewWanted.WithMedium(ReleaseImportMediumIntent.Digital.Create()),
            selected);

        Assert.True(selected.IsOriginal);
        Assert.False(other.IsOriginal);
    }

    [Fact(DisplayName = "Missing Wanted medium remains editable but blocks external confirmation")]
    public void Missing_wanted_medium_remains_editable_but_blocks_external_confirmation()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(draft);
        draft.InitializeExternalReview(
            MusicBrainzBinding(row.Id),
            ReleaseImportCollectionItemIntent.NewWanted.WithoutMedium(),
            row);

        ReleaseImportRelationSuggestion relation = RejectedRequiredSuggestion(draft, row);
        Assert.False(draft.IsExternalConfirmationReady(row, relation, null, linkedTargetIsStandalone: false));

        draft.SetExternalCollectionItemIntent(ReleaseImportCollectionItemIntent.NewWanted.WithMedium(
            ReleaseImportMediumIntent.Digital.Create()));

        Assert.True(draft.IsExternalConfirmationReady(row, relation, null, linkedTargetIsStandalone: false));
        Assert.Equal(1, draft.ExternalReviewRevision);
    }

    private static T Present<T>(IOptionalValue<T> value)
        where T : notnull
    {
        return Assert.IsType<PresentOptionalValue<T>>(value).Value;
    }
}
