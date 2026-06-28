using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportConfirmationPreflightService
{
    private static async Task<TrackPlanBuildResult> BuildTrackPlansAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        PreflightTarget target,
        IReadOnlyList<ReleaseImportDraftTrack> skippedTracks,
        IReadOnlyList<ReleaseImportDraftTrack> includedTracks,
        CancellationToken cancellationToken)
    {
        List<ReleaseImportConfirmationTrackPlanResponse> trackPlans = [];
        var counters = new TrackPlanCounters();

        foreach (ReleaseImportDraftTrack skippedTrack in skippedTracks)
        {
            trackPlans.Add(SkippedTrackPlan(skippedTrack));
        }

        foreach (ReleaseImportDraftTrack includedTrack in includedTracks)
        {
            IncludedTrackPlan includedPlan = await IncludedTrackPlanAsync(context, collectionId, target, includedTrack, cancellationToken);
            counters.CountPlan(includedPlan.LocalFileAction, includedPlan.DigitalTrackFileLinkAction);
            trackPlans.Add(includedPlan.Plan);
        }

        return new TrackPlanBuildResult(trackPlans, counters);
    }

    private static ReleaseImportConfirmationTrackPlanResponse SkippedTrackPlan(ReleaseImportDraftTrack skippedTrack)
    {
        return new ReleaseImportConfirmationTrackPlanResponse(
            skippedTrack.Id.Value,
            skippedTrack.Title,
            skippedTrack.Position,
            IsSkipped: true,
            skippedTrack.SelectedTrackId?.Value,
            ActionSkip,
            ActionSkip,
            ActionSkip);
    }

    private static async Task<IncludedTrackPlan> IncludedTrackPlanAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        PreflightTarget target,
        ReleaseImportDraftTrack includedTrack,
        CancellationToken cancellationToken)
    {
        string trackAction = includedTrack.TrackMode switch
        {
            ReleaseImportTrackMode.Create => ActionCreate,
            ReleaseImportTrackMode.Link => ActionReuse,
            ReleaseImportTrackMode.ReleaseOnly => ActionReleaseOnly,
            _ => throw new InvalidOperationException("Release import track mode is not supported")
        };
        LocalAudioFile? localFile = await FindLocalAudioFileAsync(context, collectionId, includedTrack, cancellationToken);
        string localFileAction = localFile is null ? ActionCreate : ActionUpdate;
        string fileLinkAction = await FileLinkActionAsync(
            target.Release,
            target.DigitalOwnedItem,
            localFile,
            includedTrack,
            context,
            collectionId,
            cancellationToken);

        return new IncludedTrackPlan(
            new ReleaseImportConfirmationTrackPlanResponse(
                includedTrack.Id.Value,
                includedTrack.Title,
                includedTrack.Position,
                IsSkipped: false,
                includedTrack.SelectedTrackId?.Value,
                trackAction,
                localFileAction,
                fileLinkAction),
            localFileAction,
            fileLinkAction);
    }

    private sealed record TrackPlanBuildResult(
        IReadOnlyList<ReleaseImportConfirmationTrackPlanResponse> Plans,
        TrackPlanCounters Counters);

    private sealed record IncludedTrackPlan(
        ReleaseImportConfirmationTrackPlanResponse Plan,
        string LocalFileAction,
        string DigitalTrackFileLinkAction);

    private sealed class TrackPlanCounters
    {
        public int NewLocalAudioFiles { get; private set; }

        public int UpdatedLocalAudioFiles { get; private set; }

        public int NewDigitalTrackFileLinks { get; private set; }

        public int RelinkedDigitalTrackFileLinks { get; private set; }

        public int UnchangedDigitalTrackFileLinks { get; private set; }

        public void CountPlan(string localFileAction, string fileLinkAction)
        {
            if (localFileAction == ActionCreate)
            {
                NewLocalAudioFiles++;
            }
            else if (localFileAction == ActionUpdate)
            {
                UpdatedLocalAudioFiles++;
            }

            if (fileLinkAction == ActionCreate)
            {
                NewDigitalTrackFileLinks++;
            }
            else if (fileLinkAction == ActionRelink)
            {
                RelinkedDigitalTrackFileLinks++;
            }
            else if (fileLinkAction == ActionUnchanged)
            {
                UnchangedDigitalTrackFileLinks++;
            }
        }
    }
}
