using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Tests.Imports;

public sealed partial class ReleaseImportDraftTests
{
    [Fact(DisplayName = "Local file factories retain their source kind and source data")]
    public void Local_file_factories_retain_their_source_kind_and_source_data()
    {
        var collectionId = CollectionId.New();
        var sessionId = ReleaseImportSessionId.New();
        var draftId = ReleaseImportDraftId.New();
        var file = new DraftTrackFileInfo(
            "/music/release/01.flac",
            "release/01.flac",
            AudioFileFormat.Flac,
            1,
            DateTimeOffset.UtcNow,
            Optional.Missing<string>(),
            DraftTrackFileMetadata.Empty);

        var session = ReleaseImportSession.Create(collectionId, sessionId, "/music", DateTimeOffset.UtcNow);
        var draft = ReleaseImportDraft.Create(collectionId, sessionId, draftId, "/music/release", "release");
        var track = ReleaseImportDraftTrack.Create(
            collectionId,
            draftId,
            ReleaseImportDraftTrackId.New(),
            file);

        Assert.Equal(ReleaseImportSourceKind.LocalFiles, session.SourceKind);
        Assert.Equal("/music", Assert.IsType<PresentOptionalValue<string>>(session.SourceRoot).Value);
        Assert.Equal(ReleaseImportScanMode.Full, Assert.IsType<PresentOptionalValue<ReleaseImportScanMode>>(session.ScanMode).Value);
        Assert.Equal(ReleaseImportSourceKind.LocalFiles, draft.SourceKind);
        Assert.Equal("/music/release", Assert.IsType<PresentOptionalValue<string>>(draft.SourcePath).Value);
        Assert.Equal("release", Assert.IsType<PresentOptionalValue<string>>(draft.RelativePath).Value);
        Assert.Equal(ReleaseImportSourceKind.LocalFiles, track.SourceKind);
        _ = Assert.IsType<PresentOptionalValue<ReleaseImportLocalFileDescriptor>>(track.LocalFile);
    }

    [Theory(DisplayName = "Local file sessions reject missing source roots")]
    [InlineData("")]
    [InlineData("   ")]
    public void Local_file_sessions_reject_missing_source_roots(string sourceRoot)
    {
        DomainException exception = Assert.Throws<DomainException>(() => ReleaseImportSession.CreateLocalFiles(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            sourceRoot,
            DateTimeOffset.UtcNow));

        Assert.Equal("release_import.source_root_required", exception.Code);
    }

    [Fact(DisplayName = "Local file sessions retain their selected scan mode")]
    public void Local_file_sessions_retain_their_selected_scan_mode()
    {
        var session = ReleaseImportSession.CreateLocalFiles(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            "/music",
            DateTimeOffset.UtcNow,
            ReleaseImportScanMode.NamesOnly);

        Assert.Equal(ReleaseImportScanMode.NamesOnly, Assert.IsType<PresentOptionalValue<ReleaseImportScanMode>>(session.ScanMode).Value);
    }

    [Fact(DisplayName = "External metadata factories leave local source values missing")]
    public void External_metadata_factories_leave_local_source_values_missing()
    {
        var collectionId = CollectionId.New();
        var sessionId = ReleaseImportSessionId.New();
        var draftId = ReleaseImportDraftId.New();

        var session = ReleaseImportSession.CreateExternalMetadata(collectionId, sessionId, DateTimeOffset.UtcNow);
        var draft = ReleaseImportDraft.CreateExternalMetadata(collectionId, sessionId, draftId);
        var track = ReleaseImportDraftTrack.CreateExternalMetadata(
            collectionId,
            draftId,
            ReleaseImportDraftTrackId.New());

        Assert.Equal(ReleaseImportSourceKind.ExternalMetadata, session.SourceKind);
        _ = Assert.IsType<MissingOptionalValue<string>>(session.SourceRoot);
        _ = Assert.IsType<MissingOptionalValue<ReleaseImportScanMode>>(session.ScanMode);
        Assert.Equal(ReleaseImportSourceKind.ExternalMetadata, draft.SourceKind);
        _ = Assert.IsType<MissingOptionalValue<string>>(draft.SourcePath);
        _ = Assert.IsType<MissingOptionalValue<string>>(draft.RelativePath);
        Assert.Equal(ReleaseImportSourceKind.ExternalMetadata, track.SourceKind);
        _ = Assert.IsType<MissingOptionalValue<ReleaseImportLocalFileDescriptor>>(track.LocalFile);
    }

    [Fact(DisplayName = "External metadata tracks retain editable track metadata")]
    public void External_metadata_tracks_retain_editable_track_metadata()
    {
        var track = ReleaseImportDraftTrack.CreateExternalMetadata(
            CollectionId.New(),
            ReleaseImportDraftId.New(),
            ReleaseImportDraftTrackId.New());

        track.UpdateEditableFields(new DraftTrackEditableFields(
            1,
            null,
            null,
            "Metadata track",
            TimeSpan.FromSeconds(194),
            1994,
            [],
            [],
            false,
            [],
            ReleaseImportTrackMode.ReleaseOnly,
            null,
            false,
            []));

        Assert.Equal("Metadata track", track.Title);
        Assert.Equal(TimeSpan.FromSeconds(194), track.Duration);
        Assert.Equal(1994, track.VersionYear);
    }

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

}
