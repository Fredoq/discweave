using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Tests.Imports;

public sealed partial class ExternalReleaseImportDraftTests
{
    [Fact]
    public void Track_merge_preserves_external_binding_provenance_and_advances_review_revision()
    {
        var duplicate = TrackId.New();
        var keeper = TrackId.New();
        var release = ReleaseId.New();
        ReleaseImportDraft draft = ExternalDraft(ReleaseImportLocalProvenanceSelection.Empty()
            .WithRelease(release).WithTrack(duplicate));
        ReleaseImportDraftTrack row = ExternalRow(draft);
        SelectedOriginalBinding binding = MusicBrainzBinding(row.Id, duplicate);
        draft.InitializeExternalReview(binding,
            ReleaseImportCollectionItemIntent.NewWanted.WithMedium(ReleaseImportMediumIntent.Digital.Create()), row);
        long revision = draft.ExternalReviewRevision;

        Assert.True(draft.RetargetMergedTrackReferences(new HashSet<TrackId> { duplicate }, keeper, false));

        SelectedOriginalBinding changed = Present(draft.SelectedOriginalBinding);
        Assert.Equal(keeper, changed.SourceTrackId);
        Assert.Equal(binding.DraftTrackId, changed.DraftTrackId);
        Assert.Equal(binding.TrackSources.Select(source => (source.ProviderCode, source.ResourceType, source.ExternalId, source.SourceUrl)),
            changed.TrackSources.Select(source => (source.ProviderCode, source.ResourceType, source.ExternalId, source.SourceUrl)));
        Assert.Equal(binding.PromoteLinkedTargetConfirmed, changed.PromoteLinkedTargetConfirmed);
        Assert.True(draft.IsSelectedOriginalBindingValid);
        Assert.Equal(keeper, Present(Present(draft.LocalProvenanceSelection).SelectedTrackId));
        Assert.Equal(release, Present(Present(draft.LocalProvenanceSelection).SelectedReleaseId));
        Assert.Equal(revision + 1, draft.ExternalReviewRevision);
        Assert.False(draft.RetargetMergedTrackReferences(new HashSet<TrackId> { duplicate }, keeper, false));
        Assert.Equal(revision + 1, draft.ExternalReviewRevision);
    }

    [Fact]
    public void Track_merge_preserves_the_exact_Discogs_row_fingerprint()
    {
        var duplicate = TrackId.New();
        var keeper = TrackId.New();
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(draft);
        var locator = DiscogsReleaseRowLocator.Create("123", 2, "B1", new string('a', 64));
        draft.InitializeExternalReview(SelectedOriginalBinding.CreateDiscogs(duplicate, row.Id, locator, false),
            ReleaseImportCollectionItemIntent.NewWanted.WithMedium(ReleaseImportMediumIntent.Digital.Create()), row);

        Assert.True(draft.RetargetMergedTrackReferences(new HashSet<TrackId> { duplicate }, keeper, false));

        SelectedOriginalBinding changed = Present(draft.SelectedOriginalBinding);
        Assert.Equal(keeper, changed.SourceTrackId);
        DiscogsReleaseRowLocator preserved = Present(changed.DiscogsRow);
        Assert.Equal(locator.ReleaseId, preserved.ReleaseId);
        Assert.Equal(locator.RowOrdinal, preserved.RowOrdinal);
        Assert.Equal(locator.Position, preserved.Position);
        Assert.Equal(locator.Fingerprint, preserved.Fingerprint);
    }

    [Fact]
    public void Track_merge_updates_link_identity_without_rewriting_reviewed_metadata()
    {
        var duplicate = TrackId.New();
        var keeper = TrackId.New();
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(draft, ReleaseImportTrackMode.Link, selectedTrackId: duplicate);
        string title = row.Title;
        TimeSpan? duration = row.Duration;
        int? versionYear = row.VersionYear;

        Assert.True(row.RetargetMergedTrack(new HashSet<TrackId> { duplicate }, keeper));

        Assert.Equal(keeper, row.SelectedTrackId);
        Assert.Equal(ReleaseImportTrackMode.Link, row.TrackMode);
        Assert.Equal(title, row.Title);
        Assert.Equal(duration, row.Duration);
        Assert.Equal(versionYear, row.VersionYear);
        Assert.False(row.RetargetMergedTrack(new HashSet<TrackId> { duplicate }, keeper));
    }

    [Fact]
    public void Track_merge_advances_external_review_revision_when_only_a_dependent_reference_changes()
    {
        ReleaseImportDraft draft = ExternalDraft();
        long revision = draft.ExternalReviewRevision;

        Assert.True(draft.RetargetMergedTrackReferences(new HashSet<TrackId> { TrackId.New() }, TrackId.New(), true));

        Assert.Equal(revision + 1, draft.ExternalReviewRevision);
        Assert.False(draft.SelectedOriginalBinding.HasValue);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Track_merge_preserves_relation_decisions_and_distinct_reviewed_endpoints(bool rejected)
    {
        var duplicate = TrackId.New();
        var keeper = TrackId.New();
        var draftEndpoint = ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(new ReleaseImportDraftTrackId(duplicate.Value));
        var suggested = new ReleaseImportRelationSuggestionPayload(
            ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(duplicate), draftEndpoint, "versionOf");
        var reviewed = new ReleaseImportRelationSuggestionPayload(draftEndpoint,
            ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(duplicate), "versionOf");
        var suggestion = ReleaseImportRelationSuggestion.Create(CollectionId.New(), ReleaseImportSessionId.New(),
            ReleaseImportDraftId.New(), ReleaseImportRelationSuggestionId.New(), "version", 95, suggested);
        suggestion.Accept(reviewed);
        if (rejected)
        {
            suggestion.Reject();
        }

        Assert.True(suggestion.RetargetMergedTrackReferences(new HashSet<TrackId> { duplicate }, keeper));

        Assert.Equal(keeper.Value, suggestion.SuggestedPayload.Source.TrackId);
        Assert.Equal(draftEndpoint, suggestion.SuggestedPayload.Target);
        Assert.Equal(draftEndpoint, suggestion.ReviewedPayload.Source);
        Assert.Equal(keeper.Value, suggestion.ReviewedPayload.Target!.TrackId);
        Assert.Equal(rejected ? ReleaseImportRelationSuggestionDecision.Rejected : ReleaseImportRelationSuggestionDecision.Accepted,
            suggestion.Decision);
        Assert.False(suggestion.RetargetMergedTrackReferences(new HashSet<TrackId> { duplicate }, keeper));
    }
}
