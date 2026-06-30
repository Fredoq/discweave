using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportConfirmationPreflightService
{
    private const string ActionCreate = "create";
    private const string ActionReuse = "reuse";
    private const string ActionReleaseOnly = "releaseOnly";
    private const string ActionUpdate = "update";
    private const string ActionSkip = "skip";
    private const string ActionRelink = "relink";
    private const string ActionUnchanged = "unchanged";
    private const string OutcomeBlocked = "blocked";
    private const string OutcomeExactDuplicate = "exactDuplicate";
    private const string OutcomeNewRelease = "newRelease";
    private const string OutcomePartialDuplicate = "partialDuplicate";
    private const string DigitalMediumType = "digital";
    private const string IssueSeverityError = "error";
    private const string TrackEntity = "track";

    private static async Task<string> FileLinkActionAsync(
        Release? targetRelease,
        OwnedItem? digitalOwnedItem,
        LocalAudioFile? localFile,
        ReleaseImportDraftTrack draftTrack,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        if (targetRelease is null || digitalOwnedItem is null)
        {
            return ActionCreate;
        }

        if (draftTrack.SelectedTrackId is not { } trackId)
        {
            return ActionCreate;
        }

        ReleaseTrack? releaseTrack = ResolveReleaseTrack(targetRelease, trackId, draftTrack);
        if (releaseTrack is null)
        {
            return ActionCreate;
        }

        DigitalTrackFileLink? existingLink = context.DigitalTrackFileLinks.Local.FirstOrDefault(link =>
                link.CollectionId == collectionId &&
                link.DigitalOwnedItemId == digitalOwnedItem.Id &&
                link.ReleaseTrackId == releaseTrack.Id) ??
            await context.DigitalTrackFileLinks.AsNoTracking().SingleOrDefaultAsync(link =>
                link.CollectionId == collectionId &&
                link.DigitalOwnedItemId == digitalOwnedItem.Id &&
                link.ReleaseTrackId == releaseTrack.Id,
                cancellationToken);
        return existingLink switch
        {
            null => ActionCreate,
            _ when localFile is not null && existingLink.LocalAudioFileId == localFile.Id => ActionUnchanged,
            _ => ActionRelink
        };
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
        Add(actions, "release", ActionCreate, summary.NewReleases, "Create release");
        Add(actions, "release", ActionReuse, summary.ReusedReleases, "Reuse release");
        Add(actions, "release", ActionUpdate, summary.UpdatedReleases, "Update release tracklist");
        Add(actions, TrackEntity, ActionCreate, summary.NewTracks, "Create tracks");
        Add(actions, TrackEntity, ActionReuse, summary.ReusedTracks, "Reuse matched tracks");
        Add(actions, TrackEntity, ActionReleaseOnly, summary.ReleaseOnlyTracks, "Create release-only tracklist rows");
        Add(actions, "digitalOwnedItem", ActionCreate, summary.NewDigitalOwnedItems, "Create digital owned item");
        Add(actions, "digitalOwnedItem", ActionReuse, summary.ReusedDigitalOwnedItems, "Reuse digital owned item");
        Add(actions, "localAudioFile", ActionCreate, summary.NewLocalAudioFiles, "Create local audio file rows");
        Add(actions, "localAudioFile", ActionUpdate, summary.UpdatedLocalAudioFiles, "Update local audio file metadata");
        Add(actions, "digitalTrackFileLink", ActionCreate, summary.NewDigitalTrackFileLinks, "Create file links");
        Add(actions, "digitalTrackFileLink", ActionRelink, summary.RelinkedDigitalTrackFileLinks, "Relink moved files");
        Add(actions, "digitalTrackFileLink", ActionReuse, summary.UnchangedDigitalTrackFileLinks, "Keep existing file links");
        Add(actions, TrackEntity, ActionSkip, summary.SkippedTrackCount, "Skip tracks");
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
        return (isBlocked, exactDuplicate, partialDuplicate) switch
        {
            (true, _, _) => OutcomeBlocked,
            (_, not null, _) => OutcomeExactDuplicate,
            (_, _, not null) => OutcomePartialDuplicate,
            _ => OutcomeNewRelease
        };
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
