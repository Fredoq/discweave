using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Tests.Imports;

public sealed class ReleaseImportDraftTests
{
    [Fact(DisplayName = "Release import draft requires ready status before confirmation")]
    public void Release_import_draft_requires_ready_status_before_confirmation()
    {
        var draft = ReleaseImportDraft.Create(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportDraftId.New(),
            "/music/release",
            "release");

        DomainException exception = Assert.Throws<DomainException>(() => draft.Confirm(ReleaseId.New()));

        Assert.Equal("release_import_draft.not_ready", exception.Code);
    }

    [Fact(DisplayName = "Release import draft blocks cover artifact edits after confirmation")]
    public void Release_import_draft_blocks_cover_artifact_edits_after_confirmation()
    {
        ReleaseImportDraft draft = ReadyDraft();
        draft.Confirm(ReleaseId.New());

        DomainException exception = Assert.Throws<DomainException>(() => draft.SetCoverArtifact(null));

        Assert.Equal("release_import_draft.confirmed", exception.Code);
    }

    [Fact(DisplayName = "Release import draft blocks cover artifact edits after skip")]
    public void Release_import_draft_blocks_cover_artifact_edits_after_skip()
    {
        ReleaseImportDraft draft = ReadyDraft();
        draft.Skip();

        DomainException exception = Assert.Throws<DomainException>(() => draft.SetCoverArtifact(null));

        Assert.Equal("release_import_draft.skipped", exception.Code);
    }

    [Fact(DisplayName = "Release import draft preserves artist credit external source")]
    public void Release_import_draft_preserves_artist_credit_external_source()
    {
        var draft = ReleaseImportDraft.Create(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportDraftId.New(),
            "/music/release",
            "release");

        draft.UpdateEditableFields(new ReleaseImportDraftEditableFields(
            "Show Me Love",
            "single",
            Optional.Missing<string>(),
            Optional.Missing<string>(),
            Optional.Missing<DateOnly>(),
            Optional.From(1993),
            false,
            false,
            Optional.Missing<string>(),
            [],
            [
                new ReleaseImportArtistCredit(
                    null,
                    "Robin Stone",
                    "mainArtist",
                    new ReleaseImportArtistCreditExternalSource(
                        "discogs",
                        "artist",
                        "111",
                        "https://www.discogs.com/artist/111"))
            ],
            [],
            [],
            [],
            [],
            [],
            true,
            []));

        ReleaseImportArtistCredit credit = Assert.Single(draft.ArtistCredits);
        Assert.Equal("Robin Stone", credit.Name);
        Assert.Equal("discogs", credit.ExternalSource?.ProviderName);
        Assert.Equal("artist", credit.ExternalSource?.ResourceType);
        Assert.Equal("111", credit.ExternalSource?.ExternalId);
    }

    [Fact(DisplayName = "Release import Discogs artist credit sources infer missing source URLs")]
    public void Release_import_Discogs_artist_credit_sources_infer_missing_source_urls()
    {
        var draft = ReleaseImportDraft.Create(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportDraftId.New(),
            "/music/release",
            "release");
        var source = new ReleaseImportArtistCreditExternalSource(" discogs ", " artist ", "111", " ");

        draft.UpdateEditableFields(new ReleaseImportDraftEditableFields(
            "Show Me Love",
            "single",
            Optional.Missing<string>(),
            Optional.Missing<string>(),
            Optional.Missing<DateOnly>(),
            Optional.From(1993),
            false,
            false,
            Optional.Missing<string>(),
            [],
            [new ReleaseImportArtistCredit(null, "Robin Stone", "mainArtist", source)],
            [],
            [],
            [],
            [],
            [],
            true,
            []));
        var track = ReleaseImportDraftTrack.Create(
            CollectionId.New(),
            ReleaseImportDraftId.New(),
            ReleaseImportDraftTrackId.New(),
            new DraftTrackFileInfo(
                "/music/01.flac",
                "01.flac",
                AudioFileFormat.Flac,
                1,
                DateTimeOffset.UtcNow,
                Optional.Missing<string>(),
                DraftTrackFileMetadata.Empty));
        track.UpdateEditableFields(new DraftTrackEditableFields(
            1,
            null,
            null,
            "Show Me Love",
            null,
            null,
            [],
            [new ReleaseImportArtistCredit(null, "Robin Stone", "mainArtist", source)],
            false,
            [],
            ReleaseImportTrackMode.Create,
            null,
            false,
            []));

        ReleaseImportArtistCredit draftCredit = Assert.Single(draft.ArtistCredits);
        ReleaseImportArtistCredit trackCredit = Assert.Single(track.ArtistCredits);
        Assert.Equal("https://www.discogs.com/artist/111", draftCredit.ExternalSource?.SourceUrl);
        Assert.Equal("https://www.discogs.com/artist/111", trackCredit.ExternalSource?.SourceUrl);
    }

    [Fact(DisplayName = "Release import preserves source-only artist credits")]
    public void Release_import_preserves_source_only_artist_credits()
    {
        var source = new ReleaseImportArtistCreditExternalSource(
            "discogs",
            "artist",
            "111",
            "https://www.discogs.com/artist/111");
        var draft = ReleaseImportDraft.Create(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportDraftId.New(),
            "/music/release",
            "release");

        draft.UpdateEditableFields(new ReleaseImportDraftEditableFields(
            "Show Me Love",
            "single",
            Optional.Missing<string>(),
            Optional.Missing<string>(),
            Optional.Missing<DateOnly>(),
            Optional.From(1993),
            false,
            false,
            Optional.Missing<string>(),
            [],
            [new ReleaseImportArtistCredit(null, " ", "mainArtist", source)],
            [],
            [],
            [],
            [],
            [],
            true,
            []));
        var track = ReleaseImportDraftTrack.Create(
            CollectionId.New(),
            ReleaseImportDraftId.New(),
            ReleaseImportDraftTrackId.New(),
            new DraftTrackFileInfo(
                "/music/01.flac",
                "01.flac",
                AudioFileFormat.Flac,
                1,
                DateTimeOffset.UtcNow,
                Optional.Missing<string>(),
                DraftTrackFileMetadata.Empty));
        track.UpdateEditableFields(new DraftTrackEditableFields(
            1,
            null,
            null,
            "Show Me Love",
            null,
            null,
            [],
            [new ReleaseImportArtistCredit(null, " ", "mainArtist", source)],
            false,
            [],
            ReleaseImportTrackMode.Create,
            null,
            false,
            []));

        Assert.Empty(Assert.Single(draft.ArtistCredits).Name);
        Assert.Equal("111", Assert.Single(draft.ArtistCredits).ExternalSource?.ExternalId);
        Assert.Empty(Assert.Single(track.ArtistCredits).Name);
        Assert.Equal("111", Assert.Single(track.ArtistCredits).ExternalSource?.ExternalId);
    }

    private static ReleaseImportDraft ReadyDraft()
    {
        var draft = ReleaseImportDraft.Create(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportDraftId.New(),
            "/music/release",
            "release");
        draft.UpdateEditableFields(new ReleaseImportDraftEditableFields(
            "Release",
            "unknown",
            Optional.Missing<string>(),
            Optional.Missing<string>(),
            Optional.Missing<DateOnly>(),
            Optional.Missing<int>(),
            false,
            false,
            Optional.Missing<string>(),
            [],
            [],
            [],
            [],
            [],
            [],
            [],
            true,
            []));

        return draft;
    }
}
