using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Api.Features.ReviewWorkbench;

public static partial class ReviewWorkbenchSignalBuilder
{
    private static ReviewWorkbenchSignalTarget[] ImportTargets(
        ReleaseImportSession session,
        ReleaseImportDraft draft,
        IReadOnlyDictionary<Guid, string> releaseTitles,
        IReadOnlyDictionary<Guid, string> trackTitles)
    {
        List<ReviewWorkbenchSignalTarget> targets = [];
        if (draft.ConfirmedReleaseId is { } releaseId)
        {
            string releaseTitle = ResolveTargetTitle(ReviewWorkbenchTargetKinds.Release, releaseId.Value, releaseTitles, trackTitles);
            targets.Add(Target(
                ReviewWorkbenchTargetKinds.Release,
                releaseId.Value,
                releaseTitle,
                DraftSourceLabel(draft)));
        }

        targets.Add(Target(
            ReviewWorkbenchTargetKinds.ImportSession,
            session.Id.Value,
            $"Import session: {SessionSourceLabel(session, draft)}",
            DraftSourceLabel(draft)));

        return [.. targets];
    }

    private static string SessionSourceLabel(ReleaseImportSession session, ReleaseImportDraft draft)
    {
        return session.SourceKind switch
        {
            ReleaseImportSourceKind.LocalFiles => OptionalString(session.SourceRoot) ?? "Local files",
            ReleaseImportSourceKind.ExternalMetadata => ExternalMetadataSourceLabel(draft),
            _ => throw new InvalidOperationException("Release import source kind is not supported")
        };
    }

    private static string DraftSourceLabel(ReleaseImportDraft draft)
    {
        return draft.SourceKind switch
        {
            ReleaseImportSourceKind.LocalFiles => OptionalString(draft.RelativePath) ?? "Local files",
            ReleaseImportSourceKind.ExternalMetadata => ExternalMetadataSourceLabel(draft),
            _ => throw new InvalidOperationException("Release import source kind is not supported")
        };
    }

    private static string TrackSourceLabel(ReleaseImportDraft draft, ReleaseImportDraftTrack track)
    {
        return track.SourceKind switch
        {
            ReleaseImportSourceKind.LocalFiles => RequiredLocalFile(track).FilePath,
            ReleaseImportSourceKind.ExternalMetadata => ExternalMetadataSourceLabel(draft),
            _ => throw new InvalidOperationException("Release import source kind is not supported")
        };
    }

    private static string ExternalMetadataSourceLabel(ReleaseImportDraft draft)
    {
        string? providerName = draft.ExternalSources
            .Select(source => source.ProviderName.Trim())
            .FirstOrDefault(name => name.Length > 0);
        return providerName is null ? "External metadata" : $"External metadata: {providerName}";
    }

    private static ReleaseImportLocalFileDescriptor RequiredLocalFile(ReleaseImportDraftTrack track)
    {
        return track.LocalFile is PresentOptionalValue<ReleaseImportLocalFileDescriptor> localFile
            ? localFile.Value
            : throw new DomainException(
                "release_import.local_file_required",
                "Local file import track is missing its local file descriptor");
    }
}
