using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ReleaseImportConfirmationPreflightService
{
    private const string DigitalMediumType = "digital";

    private static string FileLinkAction(
        Release? targetRelease,
        OwnedItem? digitalOwnedItem,
        LocalAudioFile? localFile,
        ReleaseImportDraftTrack draftTrack,
        string outcome,
        DiscWeaveDbContext context,
        CollectionId collectionId)
    {
        if (targetRelease is null || digitalOwnedItem is null)
        {
            return "create";
        }

        if (outcome == "partialDuplicate")
        {
            return "create";
        }

        if (draftTrack.SelectedTrackId is not { } trackId)
        {
            return "create";
        }

        ReleaseTrack? releaseTrack = ResolveReleaseTrack(targetRelease, trackId, draftTrack);
        if (releaseTrack is null)
        {
            return "create";
        }

        DigitalTrackFileLink? existingLink = context.DigitalTrackFileLinks.Local.FirstOrDefault(link =>
                link.CollectionId == collectionId &&
                link.DigitalOwnedItemId == digitalOwnedItem.Id &&
                link.ReleaseTrackId == releaseTrack.Id) ??
            context.DigitalTrackFileLinks.AsNoTracking().SingleOrDefault(link =>
                link.CollectionId == collectionId &&
                link.DigitalOwnedItemId == digitalOwnedItem.Id &&
                link.ReleaseTrackId == releaseTrack.Id);
        return existingLink is null
            ? "create"
            : localFile is not null && existingLink.LocalAudioFileId == localFile.Id
                ? "unchanged"
                : "relink";
    }

    private static ReleaseTrack? ResolveReleaseTrack(Release release, TrackId trackId, ReleaseImportDraftTrack draftTrack)
    {
        ReleaseTrack[] candidates = [.. release.Tracklist.Where(track => track.TrackId == trackId)];
        if (candidates.Length == 0)
        {
            return null;
        }

        if (draftTrack.Position is { } position)
        {
            ReleaseTrack[] positionMatches = [.. candidates.Where(track => track.Position.Number == position)];
            if (positionMatches.Length == 1)
            {
                return positionMatches[0];
            }
        }

        return candidates.Length == 1 ? candidates[0] : null;
    }

    private static async Task<OwnedItem?> FindDigitalOwnedItemAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseId releaseId,
        CancellationToken cancellationToken)
    {
        return await context.OwnedItems.SingleOrDefaultAsync(
            item =>
                item.CollectionId == collectionId &&
                EF.Property<ReleaseId>(item, "_releaseId") == releaseId &&
                EF.Property<string>(item, "_mediumType") == DigitalMediumType,
            cancellationToken);
    }

    private static async Task<LocalAudioFile?> FindLocalAudioFileAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportDraftTrack draftTrack,
        CancellationToken cancellationToken)
    {
        var path = FilePath.FromAbsolutePath(draftTrack.FilePath);
        return await context.LocalAudioFiles.SingleOrDefaultAsync(
            file => file.CollectionId == collectionId && file.Path == path,
            cancellationToken);
    }

    private static IReadOnlyList<ImportIssueResponse> Issues(
        ReleaseImportDraft draft,
        IReadOnlyList<ReleaseImportDraftTrack> tracks)
    {
        return
        [
            .. draft.Issues
                .Concat(tracks.SelectMany(track => track.Issues))
                .GroupBy(issue => new { issue.Code, issue.Message, issue.Severity })
                .Select(group => ToIssueResponse(group.First()))
        ];
    }

    private static List<ReleaseImportConfirmationActionResponse> Actions(
        ReleaseImportConfirmationSummaryResponse summary)
    {
        List<ReleaseImportConfirmationActionResponse> actions = [];
        Add(actions, "release", "create", summary.NewReleases, "Create release");
        Add(actions, "release", "reuse", summary.ReusedReleases, "Reuse release");
        Add(actions, "release", "update", summary.UpdatedReleases, "Update release tracklist");
        Add(actions, "track", "create", summary.NewTracks, "Create tracks");
        Add(actions, "track", "reuse", summary.ReusedTracks, "Reuse matched tracks");
        Add(actions, "digitalOwnedItem", "create", summary.NewDigitalOwnedItems, "Create digital owned item");
        Add(actions, "digitalOwnedItem", "reuse", summary.ReusedDigitalOwnedItems, "Reuse digital owned item");
        Add(actions, "localAudioFile", "create", summary.NewLocalAudioFiles, "Create local audio file rows");
        Add(actions, "localAudioFile", "update", summary.UpdatedLocalAudioFiles, "Update local audio file metadata");
        Add(actions, "digitalTrackFileLink", "create", summary.NewDigitalTrackFileLinks, "Create file links");
        Add(actions, "digitalTrackFileLink", "relink", summary.RelinkedDigitalTrackFileLinks, "Relink moved files");
        Add(actions, "digitalTrackFileLink", "reuse", summary.UnchangedDigitalTrackFileLinks, "Keep existing file links");
        Add(actions, "track", "skip", summary.SkippedTrackCount, "Skip tracks");
        return actions;
    }

    private static void Add(
        List<ReleaseImportConfirmationActionResponse> actions,
        string kind,
        string action,
        int count,
        string label)
    {
        if (count > 0)
        {
            actions.Add(new ReleaseImportConfirmationActionResponse(kind, action, count, label));
        }
    }

    private static string Outcome(Release? exactDuplicate, Release? partialDuplicate, bool isBlocked)
    {
        return isBlocked
            ? "blocked"
            : exactDuplicate is not null
                ? "exactDuplicate"
                : partialDuplicate is not null
                    ? "partialDuplicate"
                    : "newRelease";
    }

    private static ImportIssueResponse ToIssueResponse(ImportReviewIssue issue)
    {
        return new ImportIssueResponse(issue.Code, issue.Message, IssueSeverityCode(issue.Severity));
    }

    private static string IssueSeverityCode(ImportReviewSeverity severity)
    {
        return severity switch
        {
            ImportReviewSeverity.Info => "info",
            ImportReviewSeverity.Warning => "warning",
            ImportReviewSeverity.Error => "error",
            _ => throw new InvalidOperationException("Import review issue severity is not supported")
        };
    }

    private static string DraftStatusCode(ReleaseImportDraftStatus status)
    {
        return status switch
        {
            ReleaseImportDraftStatus.NeedsReview => "needsReview",
            ReleaseImportDraftStatus.Ready => "ready",
            ReleaseImportDraftStatus.Confirmed => "confirmed",
            ReleaseImportDraftStatus.Skipped => "skipped",
            _ => throw new InvalidOperationException("Release import draft status is not supported")
        };
    }
}
