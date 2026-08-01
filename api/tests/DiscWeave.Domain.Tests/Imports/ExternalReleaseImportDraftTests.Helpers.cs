using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Tests.Imports;

public sealed partial class ExternalReleaseImportDraftTests
{
    private static ReleaseImportDraft ExternalDraft(ReleaseImportLocalProvenanceSelection? selection = null)
    {
        return ReleaseImportDraft.CreateExternalMetadata(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportDraftId.New(),
            selection ?? ReleaseImportLocalProvenanceSelection.Empty());
    }

    private static ReleaseImportDraftTrack ExternalRow(
        ReleaseImportDraft draft,
        ReleaseImportTrackMode mode = ReleaseImportTrackMode.Create,
        bool isSkipped = false,
        TrackId? selectedTrackId = null)
    {
        return ReleaseImportDraftTrack.CreateExternalMetadata(
            draft.CollectionId,
            draft.Id,
            ReleaseImportDraftTrackId.New(),
            EditableFields(1, mode, selectedTrackId, isSkipped, "Original"));
    }

    private static DraftTrackEditableFields EditableFields(
        int? position,
        ReleaseImportTrackMode mode,
        TrackId? selectedTrackId,
        bool isSkipped,
        string title)
    {
        return new DraftTrackEditableFields(
            position,
            null,
            null,
            title,
            TimeSpan.FromMinutes(3),
            1994,
            [],
            [],
            false,
            [],
            mode,
            selectedTrackId,
            isSkipped,
            []);
    }

    private static SelectedOriginalBinding MusicBrainzBinding(
        ReleaseImportDraftTrackId rowId,
        TrackId? sourceTrackId = null,
        bool promoteLinkedTargetConfirmed = false)
    {
        ReleaseImportProviderReference release = MusicBrainzRelease();
        return SelectedOriginalBinding.CreateMusicBrainz(
            sourceTrackId ?? TrackId.New(),
            rowId,
            MusicBrainzRecording(),
            ExternalReleaseRoute.CreateMusicBrainz(release),
            MusicBrainzReleaseRowLocator.Create(release.ExternalId, "1", Guid.NewGuid().ToString("D")),
            promoteLinkedTargetConfirmed);
    }

    private static ReleaseImportProviderReference MusicBrainzRelease()
    {
        var id = Guid.NewGuid();
        return ReleaseImportProviderReference.Create(
            "musicbrainz",
            "release",
            id.ToString("D"),
            $"https://musicbrainz.org/release/{id:D}");
    }

    private static ReleaseImportProviderReference MusicBrainzRecording()
    {
        var id = Guid.NewGuid();
        return ReleaseImportProviderReference.Create(
            "musicbrainz",
            "recording",
            id.ToString("D"),
            $"https://musicbrainz.org/recording/{id:D}");
    }

    private static ReleaseImportProviderReference DiscogsRelease(string id)
    {
        return ReleaseImportProviderReference.Create(
            "discogs",
            "release",
            id,
            $"https://www.discogs.com/release/{id}");
    }

    private static void Initialize(ReleaseImportDraft draft, ReleaseImportDraftTrack row)
    {
        draft.InitializeExternalReview(
            MusicBrainzBinding(row.Id),
            ReleaseImportCollectionItemIntent.NewWanted.WithMedium(ReleaseImportMediumIntent.Digital.Create()),
            row);
    }

    private static ReleaseImportRelationSuggestion RequiredSuggestion(
        ReleaseImportDraft draft,
        ReleaseImportDraftTrack row)
    {
        SelectedOriginalBinding binding = Present(draft.SelectedOriginalBinding);
        return ReleaseImportRelationSuggestion.CreateRequired(
            draft.CollectionId,
            draft.SessionId,
            draft.Id,
            ReleaseImportRelationSuggestionId.New(),
            "original-discovery",
            100,
            new ReleaseImportRelationSuggestionPayload(
                ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(binding.SourceTrackId),
                ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(row.Id),
                "versionOf"));
    }

    private static ReleaseImportRelationSuggestion RejectedRequiredSuggestion(
        ReleaseImportDraft draft,
        ReleaseImportDraftTrack row)
    {
        ReleaseImportRelationSuggestion suggestion = RequiredSuggestion(draft, row);
        suggestion.Reject();
        return suggestion;
    }
}
