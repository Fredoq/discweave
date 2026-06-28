using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;

namespace DiscWeave.Api.Features.Imports;

internal static partial class ReleaseImportResponseMapper
{
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

    private static string StatusCode(ReleaseImportSessionStatus status)
    {
        return status switch
        {
            ReleaseImportSessionStatus.ReadyForReview => "readyForReview",
            ReleaseImportSessionStatus.Completed => "completed",
            _ => throw new InvalidOperationException("Release import session status is not supported")
        };
    }

    private static string ScanModeCode(ReleaseImportScanMode mode)
    {
        return mode switch
        {
            ReleaseImportScanMode.Full => "full",
            ReleaseImportScanMode.NamesOnly => "namesOnly",
            _ => throw new InvalidOperationException("Release import scan mode is not supported")
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

    private static string DecisionCode(ReleaseImportRelationSuggestionDecision decision)
    {
        return decision switch
        {
            ReleaseImportRelationSuggestionDecision.Pending => "pending",
            ReleaseImportRelationSuggestionDecision.Accepted => "accepted",
            ReleaseImportRelationSuggestionDecision.Rejected => "rejected",
            _ => throw new InvalidOperationException("Release import relation suggestion decision is not supported")
        };
    }

    private static string TrackModeCode(ReleaseImportTrackMode mode)
    {
        return mode switch
        {
            ReleaseImportTrackMode.Create => "create",
            ReleaseImportTrackMode.Link => "link",
            ReleaseImportTrackMode.ReleaseOnly => "releaseOnly",
            _ => throw new InvalidOperationException("Release import track mode is not supported")
        };
    }

    private static string EndpointKindCode(ReleaseImportRelationSuggestionEndpointKind kind)
    {
        return kind switch
        {
            ReleaseImportRelationSuggestionEndpointKind.DraftTrack => "draftTrack",
            ReleaseImportRelationSuggestionEndpointKind.ExistingTrack => "existingTrack",
            _ => throw new InvalidOperationException("Release import relation suggestion endpoint kind is not supported")
        };
    }


    private static string? QualityCode(AudioFileQuality? quality)
    {
        return quality switch
        {
            null => null,
            AudioFileQuality.Lossless => "lossless",
            AudioFileQuality.Lossy => "lossy",
            _ => throw new InvalidOperationException("Audio file quality is not supported")
        };
    }
}
