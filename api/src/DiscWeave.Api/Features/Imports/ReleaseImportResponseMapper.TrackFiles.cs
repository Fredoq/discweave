using DiscWeave.Domain.Imports;
using DiscWeave.Importing;

namespace DiscWeave.Api.Features.Imports;

internal static partial class ReleaseImportResponseMapper
{
    private static ReleaseImportLooseFileCandidateResponse ToLooseFileCandidateResponse(
        ReleaseImportLooseFileCandidate candidate)
    {
        return new ReleaseImportLooseFileCandidateResponse(
            candidate.Id.Value,
            candidate.FilePath,
            candidate.RelativePath,
            ReleaseImportFileRules.FormatCode(candidate.Format),
            candidate.SizeBytes,
            candidate.LastModifiedAt,
            candidate.ContentHash,
            candidate.Duration is null ? null : (int)candidate.Duration.Value.TotalSeconds,
            candidate.Codec,
            QualityCode(candidate.Quality),
            candidate.BitrateKbps,
            candidate.SampleRateHz,
            candidate.Channels,
            candidate.TitleHint,
            candidate.ArtistHints,
            candidate.AlbumTitleHint,
            candidate.AlbumArtistHints,
            candidate.TrackNumber,
            candidate.Reason,
            candidate.Decision,
            candidate.SourceDraftId?.Value,
            candidate.SourceDraftTrackId?.Value,
            candidate.CreatedAt,
            candidate.UpdatedAt,
            null);
    }

    private static ReleaseImportLooseFileCandidateResponse ToLooseFileCandidateResponse(
        ReleaseImportLooseFileCandidate candidate,
        FileMoveHintLookup moveHints)
    {
        return ToLooseFileCandidateResponse(candidate) with
        {
            MoveHint = moveHints.ForPath(candidate.FilePath)
        };
    }

    private static ReleaseImportDraftTrackResponse ToTrackResponse(
        ReleaseImportSourceKind draftSourceKind,
        ReleaseImportDraftTrack track,
        SuggestionLookup suggestions,
        FileMoveHintLookup moveHints)
    {
        EnsureSourceKindsAgree(draftSourceKind, track.SourceKind, "release import draft and track");
        ReleaseImportLocalFileDescriptor? localFile = OptionalReference(track.LocalFile);

        return new ReleaseImportDraftTrackResponse(
            track.Id.Value,
            SourceKindCode(track.SourceKind),
            localFile?.FilePath,
            localFile?.RelativePath,
            localFile is null ? null : ReleaseImportFileRules.FormatCode(localFile.Format),
            localFile?.SizeBytes,
            localFile?.LastModifiedAt,
            localFile is null ? null : ToLocalFileResponse(localFile),
            track.Duration is null ? null : (int)track.Duration.Value.TotalSeconds,
            track.Position,
            track.Disc,
            track.Side,
            track.Title,
            track.VersionYear,
            track.ArtistNames,
            [.. EffectiveTrackArtistCredits(track).Select(ToArtistCreditResponse)],
            track.InheritReleaseArtistCredits,
            suggestions.ForArtists([.. EffectiveTrackArtistCredits(track).Select(credit => credit.Name)]),
            suggestions.ForTracks(track.Title),
            TrackModeCode(track.TrackMode),
            track.IsSkipped,
            track.SelectedTrackId?.Value,
            track.SelectedArtistIds,
            [.. track.Issues.Select(ToIssueResponse)],
            localFile is null ? null : moveHints.ForPath(localFile.FilePath));
    }

    private static ReleaseImportLocalFileResponse ToLocalFileResponse(ReleaseImportLocalFileDescriptor localFile)
    {
        return new ReleaseImportLocalFileResponse(
            localFile.FilePath,
            localFile.RelativePath,
            ReleaseImportFileRules.FormatCode(localFile.Format),
            localFile.SizeBytes,
            localFile.LastModifiedAt,
            OptionalReference(localFile.ContentHash),
            OptionalReference(localFile.Codec),
            QualityCode(OptionalStruct(localFile.Quality)),
            OptionalStruct(localFile.BitrateKbps),
            OptionalStruct(localFile.SampleRateHz),
            OptionalStruct(localFile.Channels));
    }
}
