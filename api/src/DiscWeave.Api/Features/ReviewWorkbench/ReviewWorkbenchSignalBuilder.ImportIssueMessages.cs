using DiscWeave.Domain.Imports;

namespace DiscWeave.Api.Features.ReviewWorkbench;

public static partial class ReviewWorkbenchSignalBuilder
{
    private static string ConfirmedImportIssueMessage(ImportReviewIssue issue)
    {
        return issue.Code switch
        {
            ImportIssueCodes.PartialReleaseDate =>
                "The exact release date is unknown. Review a date from the matching Discogs edition, or Resolve this notice to keep the recorded precision",
            "release_import.loose_file_album_tag_conflict" =>
                $"{AlbumConflictEvidence(issue, "album names")}. Open the release to check its title and tracklist. Resolve this notice if the grouping is intentional; audio file tags are unchanged",
            "release_import.loose_file_album_artist_conflict" =>
                $"{AlbumConflictEvidence(issue, "album artists")}. Open the release to check its artists and tracklist. Resolve this notice if the grouping is intentional; audio file tags are unchanged",
            _ => issue.Message
        };
    }

    private static string AlbumConflictEvidence(ImportReviewIssue issue, string field)
    {
        return issue.Message.StartsWith("Selected loose files have conflicting", StringComparison.Ordinal)
            ? $"Imported files contain different {field}"
            : issue.Message;
    }
}
