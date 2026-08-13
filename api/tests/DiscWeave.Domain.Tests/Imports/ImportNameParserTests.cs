using DiscWeave.Domain.Imports;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Tests.Imports;

public sealed class ImportNameParserTests
{
    [Fact(DisplayName = "Release folder parser extracts catalog date artist and title")]
    public void Release_folder_parser_extracts_catalog_date_artist_and_title()
    {
        ParsedReleaseFolder parsed = ReleaseFolderNameParser.Parse("[AA 01, 2016-07-15] Steven Julien - Fallen");

        Assert.Equal("AA 01", parsed.CatalogNumber);
        Assert.Equal(new DateOnly(2016, 7, 15), parsed.ReleaseDate);
        Assert.Equal(2016, parsed.Year);
        Assert.Equal(["Steven Julien"], parsed.ArtistNames);
        Assert.False(parsed.IsVariousArtists);
        Assert.Equal("Fallen", parsed.Title);
        Assert.Empty(parsed.Issues);
    }

    [Theory(DisplayName = "Release folder parser marks VA names as various artists")]
    [InlineData("[BP2016, 2016-06-24] Various Artists - Structures & Solutions 1996-2016")]
    [InlineData("[BP2016, 2016-06-24] VA - Structures & Solutions 1996-2016")]
    public void Release_folder_parser_marks_va_names_as_various_artists(string folderName)
    {
        ParsedReleaseFolder parsed = ReleaseFolderNameParser.Parse(folderName);

        Assert.True(parsed.IsVariousArtists);
        Assert.Empty(parsed.ArtistNames);
        Assert.Equal("Structures & Solutions 1996-2016", parsed.Title);
    }

    [Fact(DisplayName = "Release folder parser keeps partial dates as year with review issue")]
    public void Release_folder_parser_keeps_partial_dates_as_year_with_review_issue()
    {
        ParsedReleaseFolder parsed = ReleaseFolderNameParser.Parse("[CAT 1, 2015-00-00] Co La - No No");

        Assert.Null(parsed.ReleaseDate);
        Assert.Equal(2015, parsed.Year);
        Assert.Contains(parsed.Issues, issue => issue.Code == ImportIssueCodes.PartialReleaseDate);
    }

    [Fact(DisplayName = "Track file parser extracts artist and title from VA track names")]
    public void Track_file_parser_extracts_artist_and_title_from_va_track_names()
    {
        ParsedTrackFile parsed = TrackFileNameParser.Parse("06 Steve Bicknell - Disguise of Beings.flac");

        Assert.Equal(6, parsed.Position);
        Assert.Equal(["Steve Bicknell"], parsed.ArtistNames);
        Assert.Equal("Disguise of Beings", parsed.Title);
        Assert.Empty(parsed.Issues);
    }

    [Fact(DisplayName = "Track file parser splits artists by comma only")]
    public void Track_file_parser_splits_artists_by_comma_only()
    {
        ParsedTrackFile parsed = TrackFileNameParser.Parse("04 Dj Sports, C.K. & pH 1 - Second Wave");

        Assert.Equal(4, parsed.Position);
        Assert.Equal(["Dj Sports", "C.K. & pH 1"], parsed.ArtistNames);
        Assert.Equal("Second Wave", parsed.Title);
    }

    [Fact(DisplayName = "Track file parser respects caller template order")]
    public void Track_file_parser_respects_caller_template_order()
    {
        ParsedTrackFile parsed = TrackFileNameParser.Parse(
            "01 - Title.flac",
            ["{position} - {title}", "{position} {title}"]);

        Assert.Equal("Title", parsed.Title);
        Assert.Empty(parsed.ArtistNames);
    }

    [Fact(DisplayName = "Track file parser handles duplicate templates")]
    public void Track_file_parser_handles_duplicate_templates()
    {
        ParsedTrackFile parsed = TrackFileNameParser.Parse(
            "01 - Title.flac",
            ["{position} - {title}", "{position} - {title}", "{position} {title}"]);

        Assert.Equal(1, parsed.Position);
        Assert.Equal("Title", parsed.Title);
        Assert.Empty(parsed.Issues);
    }

    [Fact(DisplayName = "Import domain guards invalid numeric state")]
    public void Import_domain_guards_invalid_numeric_state()
    {
        var collectionId = CollectionId.New();

        _ = Assert.Throws<DomainException>(() => ImportPattern.Create(
            collectionId,
            ImportPatternId.New(),
            ImportPatternKind.TrackFile,
            "{position} {title}",
            -1,
            isBuiltin: false));

        var session = ReleaseImportSession.Create(
            collectionId,
            ReleaseImportSessionId.New(),
            "/music",
            DateTimeOffset.UtcNow);
        _ = Assert.Throws<DomainException>(() => session.UpdateCounts(-1, 0, 0, 0, DateTimeOffset.UtcNow));

        var track = ReleaseImportDraftTrack.Create(
            collectionId,
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
        _ = Assert.Throws<DomainException>(() => track.UpdateEditableFields(new DraftTrackEditableFields(
            -1,
            null,
            null,
            "Track",
            null,
            null,
            [],
            [],
            false,
            [],
            ReleaseImportTrackMode.Create,
            null,
            false,
            [])));
    }

    [Fact(DisplayName = "Release import draft track keeps content hash as an optional value")]
    public void Release_import_draft_track_keeps_content_hash_as_an_optional_value()
    {
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
                Optional.From(" ABCDEF "),
                DraftTrackFileMetadata.Empty));

        ReleaseImportLocalFileDescriptor localFile = Assert.IsType<PresentOptionalValue<ReleaseImportLocalFileDescriptor>>(track.LocalFile).Value;

        Assert.Equal("abcdef", Assert.IsType<PresentOptionalValue<string>>(localFile.ContentHash).Value);
    }

    [Fact(DisplayName = "Release import cover artifacts are copied")]
    public void Release_import_cover_artifacts_are_copied()
    {
        byte[] original = [1, 2, 3];
        var artifact = new ReleaseImportCoverArtifact("cover.jpg", ".jpg", "image/jpeg", original.Length, original);
        original[0] = 9;

        byte[] firstRead = [.. artifact.Content];
        firstRead[1] = 9;

        Assert.Equal([1, 2, 3], artifact.Content);
    }

    [Fact(DisplayName = "Release import draft guards terminal transitions")]
    public void Release_import_draft_guards_terminal_transitions()
    {
        var collectionId = CollectionId.New();
        var sessionId = ReleaseImportSessionId.New();
        var draft = ReleaseImportDraft.Create(collectionId, sessionId, ReleaseImportDraftId.New(), "/music/release", "release");
        draft.UpdateEditableFields(ReadyDraftFields("Release"));

        draft.Confirm(ReleaseId.New());

        _ = Assert.Throws<DomainException>(() => draft.UpdateEditableFields(ReadyDraftFields("Edited")));
        _ = Assert.Throws<DomainException>(draft.Skip);
    }

    [Fact(DisplayName = "Local file descriptors preserve supplied optional audio measurements")]
    public void Local_file_descriptors_preserve_supplied_optional_audio_measurements()
    {
        var descriptor = ReleaseImportLocalFileDescriptor.Create(new DraftTrackFileInfo(
            "/music/01.flac",
            "01.flac",
            AudioFileFormat.Flac,
            512,
            DateTimeOffset.UtcNow,
            Optional.From(" ABCDEF "),
            new DraftTrackFileMetadata(
                Optional.From(" FLAC "),
                Optional.From(AudioFileQuality.Lossless),
                Optional.From(1024),
                Optional.From(44100),
                Optional.From(2))));

        Assert.Equal("/music/01.flac", descriptor.FilePath);
        Assert.Equal("01.flac", descriptor.RelativePath);
        Assert.Equal(512, descriptor.SizeBytes);
        Assert.Equal("abcdef", Assert.IsType<PresentOptionalValue<string>>(descriptor.ContentHash).Value);
        Assert.Equal("FLAC", Assert.IsType<PresentOptionalValue<string>>(descriptor.Codec).Value);
        Assert.Equal(AudioFileQuality.Lossless, Assert.IsType<PresentOptionalValue<AudioFileQuality>>(descriptor.Quality).Value);
        Assert.Equal(1024, Assert.IsType<PresentOptionalValue<int>>(descriptor.BitrateKbps).Value);
        Assert.Equal(44100, Assert.IsType<PresentOptionalValue<int>>(descriptor.SampleRateHz).Value);
        Assert.Equal(2, Assert.IsType<PresentOptionalValue<int>>(descriptor.Channels).Value);
    }

    [Theory(DisplayName = "Local file descriptors reject missing paths and invalid sizes")]
    [InlineData("", "01.flac", 1)]
    [InlineData("/music/01.flac", "", 1)]
    [InlineData("/music/01.flac", "01.flac", 0)]
    public void Local_file_descriptors_reject_missing_paths_and_invalid_sizes(string filePath, string relativePath, long sizeBytes)
    {
        _ = Assert.Throws<DomainException>(() => ReleaseImportLocalFileDescriptor.Create(new DraftTrackFileInfo(
            filePath,
            relativePath,
            AudioFileFormat.Flac,
            sizeBytes,
            DateTimeOffset.UtcNow,
            Optional.Missing<string>(),
            DraftTrackFileMetadata.Empty)));
    }

    [Fact(DisplayName = "Local file descriptors identify invalid quality by domain field")]
    public void Local_file_descriptors_identify_invalid_quality_by_domain_field()
    {
        DomainException exception = Assert.Throws<DomainException>(() => ReleaseImportLocalFileDescriptor.Create(new DraftTrackFileInfo(
            "/music/01.flac",
            "01.flac",
            AudioFileFormat.Flac,
            1,
            DateTimeOffset.UtcNow,
            Optional.Missing<string>(),
            new DraftTrackFileMetadata(
                Optional.Missing<string>(),
                Optional.From((AudioFileQuality)999),
                Optional.Missing<int>(),
                Optional.Missing<int>(),
                Optional.Missing<int>()))));

        Assert.Equal("release_import.track_quality_invalid", exception.Code);
        Assert.Contains("Quality", exception.Message, StringComparison.Ordinal);
    }

    [Fact(DisplayName = "External metadata factories do not accept local file sentinel values")]
    public void External_metadata_factories_do_not_accept_local_file_sentinel_values()
    {
        System.Reflection.MethodInfo? factory = typeof(ReleaseImportDraftTrack).GetMethod(
            nameof(ReleaseImportDraftTrack.CreateExternalMetadata),
            [typeof(CollectionId), typeof(ReleaseImportDraftId), typeof(ReleaseImportDraftTrackId)]);

        Assert.NotNull(factory);
        Assert.DoesNotContain(factory.GetParameters(), parameter => parameter.ParameterType == typeof(DraftTrackFileInfo));
    }

    private static ReleaseImportDraftEditableFields ReadyDraftFields(string title)
    {
        return new ReleaseImportDraftEditableFields(
            title,
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
            true,
            []);
    }
}
