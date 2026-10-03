using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Tests.Imports;

public sealed class DiscFolderNameParserTests
{
    [Theory(DisplayName = "Disc folder parser extracts disc number marker and optional title from default templates")]
    [InlineData("Disc 01", 1, "Disc 01", null)]
    [InlineData("CD2", 2, "CD2", null)]
    [InlineData("cd 10", 10, "cd 10", null)]
    [InlineData("Part 3", 3, "Part 3", null)]
    [InlineData("Disc 03 - Retrospective Mix", 3, "Disc 03", "Retrospective Mix")]
    [InlineData("CD 1 – The Album", 1, "CD 1", "The Album")]
    public void Disc_folder_parser_extracts_disc_number_marker_and_optional_title(string folderName, int number, string marker, string? title)
    {
        ParsedDiscFolder? parsed = DiscFolderNameParser.Parse(folderName, DiscFolderNameParser.DefaultTemplates);

        Assert.NotNull(parsed);
        Assert.Equal(number, parsed.Number);
        Assert.Equal(marker, parsed.Marker);
        Assert.Equal(title, parsed.Title);
    }

    [Theory(DisplayName = "Disc folder parser rejects folders that are not disc folders")]
    [InlineData("Artwork")]
    [InlineData("Side A")]
    [InlineData("[CAT 1, 2012-05-21] Artist - Disc 2")]
    [InlineData("Discography")]
    public void Disc_folder_parser_rejects_folders_that_are_not_disc_folders(string folderName)
    {
        Assert.Null(DiscFolderNameParser.Parse(folderName, DiscFolderNameParser.DefaultTemplates));
    }

    [Fact(DisplayName = "Disc folder parser ignores templates without the disc token and supports custom labels")]
    public void Disc_folder_parser_ignores_templates_without_the_disc_token_and_supports_custom_labels()
    {
        Assert.Null(DiscFolderNameParser.Parse("Bonus", ["Bonus"]));
        Assert.Equal(2, DiscFolderNameParser.Parse("Vinyl 2 (Remixes)", ["Vinyl {disc} ({discTitle})"])?.Number);
    }

    [Fact(DisplayName = "Disc folder import patterns require the disc token")]
    public void Disc_folder_import_patterns_require_the_disc_token()
    {
        DomainException exception = Assert.Throws<DomainException>(() => ImportPattern.Create(
            CollectionId.New(),
            ImportPatternId.New(),
            ImportPatternKind.DiscFolder,
            "Bonus",
            10,
            isBuiltin: false));

        Assert.Equal("import_pattern.disc_token_required", exception.Code);
    }

    [Theory(DisplayName = "Album titles drop trailing disc markers")]
    [InlineData("Eric Prydz Presents Pryda Cd3", "Eric Prydz Presents Pryda")]
    [InlineData("Album (Disc 1)", "Album")]
    [InlineData("Album [CD 2/3]", "Album")]
    [InlineData("Album - Part 2", "Album")]
    [InlineData("Album", "Album")]
    [InlineData("CD 1", "CD 1")]
    public void Album_titles_drop_trailing_disc_markers(string title, string expected)
    {
        Assert.Equal(expected, ImportAlbumTitles.WithoutDiscSuffix(title));
    }
}
