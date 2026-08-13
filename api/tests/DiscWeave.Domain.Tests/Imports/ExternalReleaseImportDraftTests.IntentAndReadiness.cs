using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Tests.Imports;

public sealed partial class ExternalReleaseImportDraftTests
{
    [Fact(DisplayName = "Intent union base constructors are closed to external variants")]
    public void Intent_union_base_constructors_are_closed_to_external_variants()
    {
        Assert.All(
            typeof(ReleaseImportCollectionItemIntent).GetConstructors(
                System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic),
            constructor => Assert.True(constructor.IsPrivate));
        Assert.All(
            typeof(ReleaseImportMediumIntent).GetConstructors(
                System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic),
            constructor => Assert.True(constructor.IsPrivate));
    }

    [Theory(DisplayName = "Medium intents match every concrete medium with exact ordinal canonical keys")]
    [MemberData(nameof(MediumCases))]
    public void Medium_intents_match_every_concrete_medium_with_exact_ordinal_canonical_keys(
        ReleaseImportMediumIntent intent,
        IMedium medium,
        string canonicalKey)
    {
        Assert.Equal(canonicalKey, intent.CanonicalKey);
        Assert.True(intent.Matches(medium));
    }

    public static TheoryData<ReleaseImportMediumIntent, IMedium, string> MediumCases()
    {
        return new TheoryData<ReleaseImportMediumIntent, IMedium, string>
        {
            { ReleaseImportMediumIntent.Digital.Create(), DigitalFile.Create(), "digital" },
            { ReleaseImportMediumIntent.Vinyl.Create(" LP "), VinylRecord.Create("LP"), "vinyl:LP" },
            { ReleaseImportMediumIntent.CompactDisc.Create(2), CompactDisc.Create(2), "cd:2" },
            { ReleaseImportMediumIntent.Cassette.Create(" Chrome "), CassetteTape.Create("Chrome"), "cassette:Chrome" },
            { ReleaseImportMediumIntent.Other.Create(" DAT "), OtherMedium.Create("DAT"), "other:DAT" }
        };
    }

    [Fact(DisplayName = "Reuse intent detects a changed current medium")]
    public void Reuse_intent_detects_a_changed_current_medium()
    {
        var intent = ReleaseImportCollectionItemIntent.ReuseExisting.Create(
            OwnedItemId.New(),
            ReleaseImportMediumIntent.Vinyl.Create("LP"));

        Assert.True(intent.MatchesCurrentMedium(VinylRecord.Create("LP")));
        Assert.False(intent.MatchesCurrentMedium(VinylRecord.Create("2xLP")));
        Assert.False(intent.MatchesCurrentMedium(DigitalFile.Create()));
    }

    [Theory(DisplayName = "Medium intent factories reject invalid payloads")]
    [InlineData("vinyl")]
    [InlineData("cassette")]
    [InlineData("other")]
    public void Medium_intent_factories_reject_invalid_payloads(string kind)
    {
        DomainException exception = Assert.Throws<DomainException>(() => kind switch
        {
            "vinyl" => ReleaseImportMediumIntent.Vinyl.Create(" "),
            "cassette" => ReleaseImportMediumIntent.Cassette.Create(" "),
            _ => ReleaseImportMediumIntent.Other.Create(" ")
        });

        Assert.StartsWith("release_import.medium_", exception.Code, StringComparison.Ordinal);
        Assert.Equal(
            "release_import.medium_disc_count_required",
            Assert.Throws<DomainException>(() => ReleaseImportMediumIntent.CompactDisc.Create(0)).Code);
    }

    [Fact(DisplayName = "Reuse confirmation requires the persisted expected medium snapshot to remain current")]
    public void Reuse_confirmation_requires_the_persisted_expected_medium_snapshot_to_remain_current()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(draft);
        draft.InitializeExternalReview(
            MusicBrainzBinding(row.Id),
            ReleaseImportCollectionItemIntent.ReuseExisting.Create(
                OwnedItemId.New(),
                ReleaseImportMediumIntent.Vinyl.Create("LP")),
            row);

        ReleaseImportRelationSuggestion relation = RejectedRequiredSuggestion(draft, row);
        Assert.True(draft.IsExternalConfirmationReady(row, relation, VinylRecord.Create("LP"), false));
        Assert.False(draft.IsExternalConfirmationReady(row, relation, VinylRecord.Create("2xLP"), false));
    }

    [Fact(DisplayName = "Linked standalone target requires explicit promotion confirmation")]
    public void Linked_standalone_target_requires_explicit_promotion_confirmation()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(
            draft,
            ReleaseImportTrackMode.Link,
            selectedTrackId: TrackId.New());
        draft.InitializeExternalReview(
            MusicBrainzBinding(row.Id, promoteLinkedTargetConfirmed: false),
            ReleaseImportCollectionItemIntent.NewWanted.WithMedium(ReleaseImportMediumIntent.Digital.Create()),
            row);

        ReleaseImportRelationSuggestion relation = RejectedRequiredSuggestion(draft, row);
        Assert.False(draft.IsExternalConfirmationReady(row, relation, null, linkedTargetIsStandalone: true));

        SelectedOriginalBinding binding = Present(draft.SelectedOriginalBinding);
        draft.AuthoritativelyRebindSelectedOriginal(
            MusicBrainzBinding(row.Id, binding.SourceTrackId, promoteLinkedTargetConfirmed: true),
            row);

        Assert.False(Present(draft.SelectedOriginalBinding).PromoteLinkedTargetConfirmed);
        Assert.False(draft.IsExternalConfirmationReady(row, relation, null, linkedTargetIsStandalone: true));

        draft.SetLinkedTargetPromotionConfirmation(row, true);

        Assert.True(draft.IsExternalConfirmationReady(row, relation, null, linkedTargetIsStandalone: true));
    }

    [Fact(DisplayName = "Promotion confirmation is independently reviewable without retargeting provider identity")]
    public void Promotion_confirmation_is_independently_reviewable_without_retargeting_provider_identity()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(
            draft,
            ReleaseImportTrackMode.Link,
            selectedTrackId: TrackId.New());
        Initialize(draft, row);
        SelectedOriginalBinding before = Present(draft.SelectedOriginalBinding);

        draft.SetLinkedTargetPromotionConfirmation(row, true);

        SelectedOriginalBinding after = Present(draft.SelectedOriginalBinding);
        Assert.Equal(before.SourceTrackId, after.SourceTrackId);
        Assert.Equal(before.DraftTrackId, after.DraftTrackId);
        Assert.Same(before.RecordingSource, after.RecordingSource);
        Assert.Same(before.ReleaseRoute, after.ReleaseRoute);
        Assert.Same(before.MusicBrainzRow, after.MusicBrainzRow);
        Assert.True(after.PromoteLinkedTargetConfirmed);
        Assert.Equal(1, draft.ExternalReviewRevision);
    }

    [Fact(DisplayName = "Accepted Required relation needs original target while rejected relation preserves independent choice")]
    public void Accepted_required_relation_needs_original_target_while_rejected_relation_preserves_independent_choice()
    {
        ReleaseImportDraft draft = ExternalDraft();
        ReleaseImportDraftTrack row = ExternalRow(draft);
        Initialize(draft, row);
        ReleaseImportRelationSuggestion suggestion = RequiredSuggestion(draft, row);
        suggestion.Accept(suggestion.ReviewedPayload);
        draft.SetExternalTrackIsOriginal(row, false);

        Assert.False(draft.IsExternalConfirmationReady(row, suggestion, null, false));

        suggestion.Reject();

        Assert.False(row.IsOriginal);
        Assert.True(draft.IsExternalConfirmationReady(row, suggestion, null, false));
        Assert.NotNull(Present(draft.SelectedOriginalBinding));
    }
}
