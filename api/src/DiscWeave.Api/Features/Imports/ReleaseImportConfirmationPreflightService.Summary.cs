using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportConfirmationPreflightService
{
    private static ReleaseImportConfirmationSummaryResponse Summary(PreflightSummaryInputs inputs)
    {
        return new ReleaseImportConfirmationSummaryResponse(
            IncludedTrackCount: inputs.IncludedTrackCount,
            SkippedTrackCount: inputs.SkippedTrackCount,
            DuplicateTrackCount: inputs.ReusedTracks,
            NewReleases: inputs.Target.ReviewOutcome == OutcomeNewRelease ? 1 : 0,
            ReusedReleases: inputs.Target.ReviewOutcome == OutcomeExactDuplicate ? 1 : 0,
            UpdatedReleases: inputs.Target.ReviewOutcome == OutcomePartialDuplicate ? 1 : 0,
            NewTracks: inputs.NewTracks,
            ReusedTracks: inputs.ReusedTracks,
            ReleaseOnlyTracks: inputs.ReleaseOnlyTracks,
            NewDigitalOwnedItems: inputs.Target.PlansLocalFileWork && !inputs.IsBlocked && inputs.Target.DigitalOwnedItem is null ? 1 : 0,
            ReusedDigitalOwnedItems: inputs.Target.PlansLocalFileWork && inputs.Target.DigitalOwnedItem is not null ? 1 : 0,
            NewLocalAudioFiles: inputs.Counters.NewLocalAudioFiles,
            UpdatedLocalAudioFiles: inputs.Counters.UpdatedLocalAudioFiles,
            NewDigitalTrackFileLinks: inputs.Counters.NewDigitalTrackFileLinks,
            RelinkedDigitalTrackFileLinks: inputs.Counters.RelinkedDigitalTrackFileLinks,
            UnchangedDigitalTrackFileLinks: inputs.Counters.UnchangedDigitalTrackFileLinks);
    }

    private sealed record PreflightDraftContext(ReleaseImportSession Session, ReleaseImportDraft Draft);

    private static void EnsureLocalFileDescriptors(IEnumerable<ReleaseImportDraftTrack> tracks)
    {
        foreach (ReleaseImportDraftTrack track in tracks.Where(track => track.SourceKind == ReleaseImportSourceKind.LocalFiles))
        {
            _ = RequiredLocalFile(track);
        }
    }

    private static string TrackOrderKey(ReleaseImportDraftTrack track)
    {
        return track.SourceKind == ReleaseImportSourceKind.LocalFiles
            ? RequiredLocalFile(track).RelativePath
            : track.Title;
    }

    private static ReleaseImportLocalFileDescriptor RequiredLocalFile(ReleaseImportDraftTrack track)
    {
        return track.LocalFile is PresentOptionalValue<ReleaseImportLocalFileDescriptor> localFile
            ? localFile.Value
            : throw new DomainException(
                "release_import.local_file_required",
                "Local file import track is missing its local file descriptor");
    }

    private sealed record PreflightTarget(
        string ReviewOutcome,
        Release? Release,
        OwnedItem? DigitalOwnedItem,
        bool PlansLocalFileWork);

    private sealed record PreflightSummaryInputs(
        int IncludedTrackCount,
        int SkippedTrackCount,
        int ReusedTracks,
        int NewTracks,
        int ReleaseOnlyTracks,
        bool IsBlocked,
        PreflightTarget Target,
        TrackPlanCounters Counters);
}
