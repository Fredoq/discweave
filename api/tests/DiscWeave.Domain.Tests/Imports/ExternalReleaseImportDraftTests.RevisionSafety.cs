using System.Reflection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Tests.Imports;

public sealed partial class ExternalReleaseImportDraftTests
{
    [Fact(DisplayName = "Fully populated external draft materialization starts at revision zero")]
    public void Fully_populated_external_draft_materialization_starts_at_revision_zero()
    {
        var releaseId = ReleaseId.New();
        var draft = ReleaseImportDraft.CreateExternalMetadata(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportDraftId.New(),
            ReleaseFields("Initial"),
            ReleaseImportLocalProvenanceSelection.Empty().WithRelease(releaseId));

        Assert.Equal("Initial", draft.Title);
        Assert.Equal("album", draft.Type);
        Assert.Equal(1994, draft.Year);
        Assert.Equal(releaseId, Present(draft.LocalProvenanceSelection).SelectedReleaseId.Match(
            value => value,
            ReleaseId.New));
        Assert.Equal(0, draft.ExternalReviewRevision);

        draft.UpdateEditableFields(ReleaseFields("Changed"));

        Assert.Equal("Changed", draft.Title);
        Assert.Equal(1, draft.ExternalReviewRevision);
    }

    [Fact(DisplayName = "External release edits are exception atomic and semantic no-ops are revision neutral")]
    public void External_release_edits_are_exception_atomic_and_semantic_no_ops_are_revision_neutral()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftEditableFields initial = ReleaseFields("Initial");
        draft.UpdateEditableFields(initial);
        Assert.Equal(1, draft.ExternalReviewRevision);

        draft.UpdateEditableFields(ReleaseFields("Initial"));
        Assert.Equal(1, draft.ExternalReviewRevision);

        ReleaseImportDraftEditableFields invalid = ReleaseFields("Must not stick") with { Issues = null! };
        _ = Assert.ThrowsAny<Exception>(() => draft.UpdateEditableFields(invalid));

        Assert.Equal("Initial", draft.Title);
        Assert.Equal(1, draft.ExternalReviewRevision);
    }

    [Fact(DisplayName = "Revision overflow is detected before representative external review mutations")]
    public void Revision_overflow_is_detected_before_representative_external_review_mutations()
    {
        AssertDraftEditOverflowIsAtomic();
        AssertTrackEditOverflowIsAtomic();
        AssertIntentOverflowIsAtomic();
        AssertSelectionOverflowIsAtomic();
        AssertRebindOverflowIsAtomic();
        AssertCoverOverflowIsAtomic();
    }

    private static void AssertDraftEditOverflowIsAtomic()
    {
        ReleaseImportDraft draft = ExternalDraft();
        draft.UpdateEditableFields(ReleaseFields("Initial"));
        SetRevision(draft, long.MaxValue);

        draft.UpdateEditableFields(ReleaseFields("Initial"));
        _ = Assert.Throws<OverflowException>(() => draft.UpdateEditableFields(ReleaseFields("Changed")));

        Assert.Equal("Initial", draft.Title);
        Assert.Equal(long.MaxValue, draft.ExternalReviewRevision);
    }

    private static void AssertTrackEditOverflowIsAtomic()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(draft);
        Initialize(draft, row);
        SetRevision(draft, long.MaxValue);

        draft.ApplyExternalTrackReviewEdit(
            row,
            EditableFields(row.Position, row.TrackMode, row.SelectedTrackId, row.IsSkipped, row.Title));
        _ = Assert.Throws<OverflowException>(() => draft.ApplyExternalTrackReviewEdit(
            row,
            EditableFields(row.Position, row.TrackMode, row.SelectedTrackId, row.IsSkipped, "Changed")));

        Assert.Equal("Original", row.Title);
        Assert.True(draft.IsSelectedOriginalBindingValid);
    }

    private static void AssertIntentOverflowIsAtomic()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(draft);
        Initialize(draft, row);
        SetRevision(draft, long.MaxValue);

        draft.SetExternalCollectionItemIntent(ReleaseImportCollectionItemIntent.NewWanted.WithMedium(
            ReleaseImportMediumIntent.Digital.Create()));
        _ = Assert.Throws<OverflowException>(() => draft.SetExternalCollectionItemIntent(
            ReleaseImportCollectionItemIntent.NewWanted.WithMedium(ReleaseImportMediumIntent.Vinyl.Create("LP"))));

        ReleaseImportCollectionItemIntent.NewWanted intent =
            Assert.IsType<ReleaseImportCollectionItemIntent.NewWanted>(Present(draft.CollectionItemIntent));
        Assert.Equal("digital", Present(intent.Medium).CanonicalKey);
    }

    private static void AssertSelectionOverflowIsAtomic()
    {
        ReleaseImportDraft draft = ExternalDraft();
        SetRevision(draft, long.MaxValue);

        _ = Assert.Throws<OverflowException>(() => draft.AuthoritativelySelectLocalRelease(ReleaseId.New()));

        _ = Assert.IsType<MissingOptionalValue<ReleaseId>>(
            Present(draft.LocalProvenanceSelection).SelectedReleaseId);
    }

    private static void AssertRebindOverflowIsAtomic()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(draft);
        Initialize(draft, row);
        SelectedOriginalBinding binding = Present(draft.SelectedOriginalBinding);
        SetRevision(draft, long.MaxValue);

        draft.AuthoritativelyRebindSelectedOriginal(binding, row);
        _ = Assert.Throws<OverflowException>(() => draft.AuthoritativelyRebindSelectedOriginal(
            MusicBrainzBinding(row.Id, binding.SourceTrackId),
            row));

        Assert.Same(binding, Present(draft.SelectedOriginalBinding));
        Assert.Equal(long.MaxValue, draft.ExternalReviewRevision);
    }

    private static void AssertCoverOverflowIsAtomic()
    {
        ReleaseImportDraft draft = ExternalDraft();
        var initial = new ReleaseImportCoverArtifact("cover.jpg", ".jpg", "image/jpeg", 1, [1]);
        var changed = new ReleaseImportCoverArtifact("other.jpg", ".jpg", "image/jpeg", 1, [2]);
        draft.SetCoverArtifact(initial);
        SetRevision(draft, long.MaxValue);

        draft.SetCoverArtifact(initial);
        _ = Assert.Throws<OverflowException>(() => draft.SetCoverArtifact(changed));

        Assert.Equal("cover.jpg", draft.CoverFileName);
        Assert.Equal([1], draft.CoverContent);
        Assert.Equal(long.MaxValue, draft.ExternalReviewRevision);
    }

    private static ReleaseImportDraftEditableFields ReleaseFields(string title)
    {
        return new ReleaseImportDraftEditableFields(
            title,
            "album",
            Optional.From("CAT-1"),
            Optional.From("Label"),
            Optional.From(new DateOnly(1994, 1, 2)),
            Optional.From(1994),
            false,
            false,
            Optional.Missing<string>(),
            ["Artist"],
            [],
            [],
            [],
            ["Electronic"],
            ["Original"],
            true,
            []);
    }

    private static void SetRevision(ReleaseImportDraft draft, long value)
    {
        PropertyInfo property = typeof(ReleaseImportDraft).GetProperty(
            nameof(ReleaseImportDraft.ExternalReviewRevision),
            BindingFlags.Instance | BindingFlags.Public)!;
        property.SetValue(draft, value);
    }
}
