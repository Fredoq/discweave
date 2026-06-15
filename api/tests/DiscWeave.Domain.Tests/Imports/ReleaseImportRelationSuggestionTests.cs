using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Tests.Imports;

public sealed class ReleaseImportRelationSuggestionTests
{
    [Fact(DisplayName = "Release import relation suggestion starts pending with reviewed payload copied from suggested payload")]
    public void Release_import_relation_suggestion_starts_pending_with_reviewed_payload_copied_from_suggested_payload()
    {
        ReleaseImportRelationSuggestionPayload payload = SuggestedPayload();

        var suggestion = ReleaseImportRelationSuggestion.Create(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportDraftId.New(),
            ReleaseImportRelationSuggestionId.New(),
            "radio-edit",
            82,
            payload);

        Assert.Equal(ReleaseImportRelationSuggestionDecision.Pending, suggestion.Decision);
        Assert.Equal("radio-edit", suggestion.Token);
        Assert.Equal(82, suggestion.Confidence);
        Assert.Equal(payload, suggestion.SuggestedPayload);
        Assert.Equal(payload, suggestion.ReviewedPayload);
    }

    [Fact(DisplayName = "Release import relation suggestion accepts reviewed payload")]
    public void Release_import_relation_suggestion_accepts_reviewed_payload()
    {
        ReleaseImportRelationSuggestion suggestion = CreateSuggestion();
        ReleaseImportRelationSuggestionPayload reviewedPayload = new(
            ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(ReleaseImportDraftTrackId.New()),
            ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(TrackId.New()),
            "versionOf");

        suggestion.Accept(reviewedPayload);

        Assert.Equal(ReleaseImportRelationSuggestionDecision.Accepted, suggestion.Decision);
        Assert.Equal(reviewedPayload, suggestion.ReviewedPayload);
    }

    [Fact(DisplayName = "Release import relation suggestion trims token and relation type code")]
    public void Release_import_relation_suggestion_trims_token_and_relation_type_code()
    {
        var payload = new ReleaseImportRelationSuggestionPayload(
            ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(ReleaseImportDraftTrackId.New()),
            ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(TrackId.New()),
            "  versionOf  ");

        var suggestion = ReleaseImportRelationSuggestion.Create(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportDraftId.New(),
            ReleaseImportRelationSuggestionId.New(),
            "  radio-edit  ",
            82,
            payload);

        Assert.Equal("radio-edit", suggestion.Token);
        Assert.Equal("versionOf", suggestion.SuggestedPayload.RelationTypeCode);
        Assert.Equal("versionOf", suggestion.ReviewedPayload.RelationTypeCode);
    }

    [Fact(DisplayName = "Release import relation suggestion rejects without changing reviewed payload")]
    public void Release_import_relation_suggestion_rejects_without_changing_reviewed_payload()
    {
        ReleaseImportRelationSuggestion suggestion = CreateSuggestion();
        ReleaseImportRelationSuggestionPayload reviewedPayload = new(
            ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(ReleaseImportDraftTrackId.New()),
            ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(TrackId.New()),
            "versionOf");
        suggestion.Accept(reviewedPayload);

        suggestion.Reject();

        Assert.Equal(ReleaseImportRelationSuggestionDecision.Rejected, suggestion.Decision);
        Assert.Equal(reviewedPayload, suggestion.ReviewedPayload);
    }

    [Fact(DisplayName = "Release import relation suggestion reset restores suggested payload and pending decision")]
    public void Release_import_relation_suggestion_reset_restores_suggested_payload_and_pending_decision()
    {
        ReleaseImportRelationSuggestion suggestion = CreateSuggestion();
        ReleaseImportRelationSuggestionPayload suggestedPayload = suggestion.SuggestedPayload;
        suggestion.Accept(new ReleaseImportRelationSuggestionPayload(
            ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(ReleaseImportDraftTrackId.New()),
            ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(TrackId.New()),
            "versionOf"));

        suggestion.Reset();

        Assert.Equal(ReleaseImportRelationSuggestionDecision.Pending, suggestion.Decision);
        Assert.Equal(suggestedPayload, suggestion.ReviewedPayload);
    }

    [Fact(DisplayName = "Release import relation suggestion payload supports draft and existing track endpoints")]
    public void Release_import_relation_suggestion_payload_supports_draft_and_existing_track_endpoints()
    {
        var draftTrackId = ReleaseImportDraftTrackId.New();
        var existingTrackId = TrackId.New();

        var payload = new ReleaseImportRelationSuggestionPayload(
            ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(draftTrackId),
            ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(existingTrackId),
            null);

        Assert.Equal(ReleaseImportRelationSuggestionEndpointKind.DraftTrack, payload.Source.Kind);
        Assert.Equal(draftTrackId.Value, payload.Source.TrackId);
        Assert.Equal(ReleaseImportRelationSuggestionEndpointKind.ExistingTrack, payload.Target!.Kind);
        Assert.Equal(existingTrackId.Value, payload.Target.TrackId);
        Assert.Null(payload.RelationTypeCode);
    }

    [Theory(DisplayName = "Release import relation suggestion validates token and confidence")]
    [InlineData("", 50, "release_import_relation_suggestion.token_required")]
    [InlineData("   ", 50, "release_import_relation_suggestion.token_required")]
    [InlineData("radio-edit", -1, "release_import_relation_suggestion.confidence_invalid")]
    [InlineData("radio-edit", 101, "release_import_relation_suggestion.confidence_invalid")]
    public void Release_import_relation_suggestion_validates_token_and_confidence(
        string token,
        int confidence,
        string expectedCode)
    {
        DomainException exception = Assert.Throws<DomainException>(() => ReleaseImportRelationSuggestion.Create(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportDraftId.New(),
            ReleaseImportRelationSuggestionId.New(),
            token,
            confidence,
            SuggestedPayload()));

        Assert.Equal(expectedCode, exception.Code);
    }

    [Fact(DisplayName = "Release import relation suggestion validates suggested payload")]
    public void Release_import_relation_suggestion_validates_suggested_payload()
    {
        var payload = new ReleaseImportRelationSuggestionPayload(
            ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(TrackId.New()),
            ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(TrackId.New()),
            "versionOf");

        DomainException exception = Assert.Throws<DomainException>(() => ReleaseImportRelationSuggestion.Create(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportDraftId.New(),
            ReleaseImportRelationSuggestionId.New(),
            "radio-edit",
            82,
            payload));

        Assert.Equal("release_import_relation_suggestion.source_kind_invalid", exception.Code);
    }

    [Theory(DisplayName = "Release import relation suggestion validates payload endpoint kind and id")]
    [InlineData(0, "release_import_relation_suggestion.source_kind_invalid")]
    [InlineData(99, "release_import_relation_suggestion.source_kind_invalid")]
    public void Release_import_relation_suggestion_validates_payload_endpoint_kind_and_id(
        int sourceKind,
        string expectedCode)
    {
        var payload = new ReleaseImportRelationSuggestionPayload(
            new ReleaseImportRelationSuggestionEndpoint((ReleaseImportRelationSuggestionEndpointKind)sourceKind, ReleaseImportDraftTrackId.New().Value),
            null,
            "versionOf");

        DomainException exception = Assert.Throws<DomainException>(() => ReleaseImportRelationSuggestion.Create(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportDraftId.New(),
            ReleaseImportRelationSuggestionId.New(),
            "radio-edit",
            82,
            payload));

        Assert.Equal(expectedCode, exception.Code);
    }

    [Fact(DisplayName = "Release import relation suggestion validates payload endpoint id")]
    public void Release_import_relation_suggestion_validates_payload_endpoint_id()
    {
        var payload = new ReleaseImportRelationSuggestionPayload(
            new ReleaseImportRelationSuggestionEndpoint(ReleaseImportRelationSuggestionEndpointKind.DraftTrack, Guid.Empty),
            null,
            "versionOf");

        DomainException exception = Assert.Throws<DomainException>(() => ReleaseImportRelationSuggestion.Create(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportDraftId.New(),
            ReleaseImportRelationSuggestionId.New(),
            "radio-edit",
            82,
            payload));

        Assert.Equal("release_import_relation_suggestion.source_track_required", exception.Code);
    }

    [Theory(DisplayName = "Release import relation suggestion validates bounded text fields")]
    [InlineData(513, "versionOf", "release_import_relation_suggestion.token_too_long")]
    [InlineData(10, "", "release_import_relation_suggestion.relation_type_code_required")]
    [InlineData(10, "   ", "release_import_relation_suggestion.relation_type_code_required")]
    [InlineData(10, "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", "release_import_relation_suggestion.relation_type_code_too_long")]
    public void Release_import_relation_suggestion_validates_bounded_text_fields(
        int tokenLength,
        string? relationTypeCode,
        string expectedCode)
    {
        var payload = new ReleaseImportRelationSuggestionPayload(
            ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(ReleaseImportDraftTrackId.New()),
            ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(TrackId.New()),
            relationTypeCode);

        DomainException exception = Assert.Throws<DomainException>(() => ReleaseImportRelationSuggestion.Create(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportDraftId.New(),
            ReleaseImportRelationSuggestionId.New(),
            new string('x', tokenLength),
            82,
            payload));

        Assert.Equal(expectedCode, exception.Code);
    }

    private static ReleaseImportRelationSuggestion CreateSuggestion()
    {
        return ReleaseImportRelationSuggestion.Create(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportDraftId.New(),
            ReleaseImportRelationSuggestionId.New(),
            "radio-edit",
            82,
            SuggestedPayload());
    }

    private static ReleaseImportRelationSuggestionPayload SuggestedPayload()
    {
        return new ReleaseImportRelationSuggestionPayload(
            ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(ReleaseImportDraftTrackId.New()),
            null,
            "editOf");
    }
}
