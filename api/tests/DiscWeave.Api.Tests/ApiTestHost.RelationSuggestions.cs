using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Api.Tests;

internal sealed partial class ApiTestHost
{
    public async Task<Guid> SeedReleaseImportRelationSuggestionAsync(
        string relationTypeCode,
        CancellationToken cancellationToken = default)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();

        var sessionId = ReleaseImportSessionId.New();
        var draftId = ReleaseImportDraftId.New();
        var sourceTrackId = ReleaseImportDraftTrackId.New();
        var targetTrackId = ReleaseImportDraftTrackId.New();
        var suggestionId = ReleaseImportRelationSuggestionId.New();

        _ = context.ReleaseImportSessions.Add(ReleaseImportSession.Create(
            DefaultCollectionId,
            sessionId,
            "/imports/relation-suggestion",
            DateTimeOffset.UnixEpoch));
        _ = context.ReleaseImportDrafts.Add(ReleaseImportDraft.Create(
            DefaultCollectionId,
            sessionId,
            draftId,
            "/imports/relation-suggestion/release",
            "relation-suggestion/release"));
        _ = context.ReleaseImportDraftTracks.Add(CreateImportDraftTrack(
            DefaultCollectionId,
            draftId,
            sourceTrackId,
            "Track (Dub).flac",
            "Track (Dub)"));
        _ = context.ReleaseImportDraftTracks.Add(CreateImportDraftTrack(
            DefaultCollectionId,
            draftId,
            targetTrackId,
            "Track.flac",
            "Track"));

        var suggestion = ReleaseImportRelationSuggestion.Create(
            DefaultCollectionId,
            sessionId,
            draftId,
            suggestionId,
            "Dub",
            82,
            new ReleaseImportRelationSuggestionPayload(
                ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(sourceTrackId),
                ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(targetTrackId),
                relationTypeCode));
        suggestion.Accept(new ReleaseImportRelationSuggestionPayload(
            ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(sourceTrackId),
            ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(targetTrackId),
            relationTypeCode));
        _ = context.ReleaseImportRelationSuggestions.Add(suggestion);
        _ = await context.SaveChangesAsync(cancellationToken);

        return suggestionId.Value;
    }

    public async Task<ReleaseImportRelationSuggestionSnapshot?> FindReleaseImportRelationSuggestionSnapshotAsync(
        Guid suggestionId,
        CancellationToken cancellationToken = default)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();

        return await context.ReleaseImportRelationSuggestions.AsNoTracking()
            .Where(suggestion => suggestion.Id == new ReleaseImportRelationSuggestionId(suggestionId))
            .Select(suggestion => new ReleaseImportRelationSuggestionSnapshot(
                EF.Property<string>(suggestion, "_suggestedRelationTypeCode"),
                EF.Property<string>(suggestion, "_reviewedRelationTypeCode"),
                EF.Property<string>(suggestion, "_suggestedPayloadJson"),
                EF.Property<string>(suggestion, "_reviewedPayloadJson")))
            .SingleOrDefaultAsync(cancellationToken);
    }

    private static ReleaseImportDraftTrack CreateImportDraftTrack(
        CollectionId collectionId,
        ReleaseImportDraftId draftId,
        ReleaseImportDraftTrackId draftTrackId,
        string relativePath,
        string title)
    {
        var track = ReleaseImportDraftTrack.Create(
            collectionId,
            draftId,
            draftTrackId,
            new DraftTrackFileInfo(
                $"/imports/relation-suggestion/{relativePath}",
                relativePath,
                AudioFileFormat.Flac,
                123_456,
                DateTimeOffset.UnixEpoch,
                Optional.Missing<string>(),
                DraftTrackFileMetadata.Empty));
        track.UpdateEditableFields(new DraftTrackEditableFields(
            Position: null,
            Disc: null,
            Side: null,
            Title: title,
            Duration: null,
            ArtistNames: [],
            ArtistCredits: [],
            InheritReleaseArtistCredits: true,
            SelectedArtistIds: [],
            SelectedTrackId: null,
            IsSkipped: false,
            Issues: []));

        return track;
    }
}

internal sealed record ReleaseImportRelationSuggestionSnapshot(
    string SuggestedRelationTypeCode,
    string ReviewedRelationTypeCode,
    string SuggestedPayloadJson,
    string ReviewedPayloadJson);
