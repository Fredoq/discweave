using System.Text.Json;
using DiscWeave.Api.Features.ReviewWorkbench;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.Review;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Api.Tests;

internal sealed partial class ApiTestHost
{
    public async Task<string> ReadReviewIssueNoteAsync(string stableKey)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        return await context.CollectionReviewIssueStates
            .Where(state => state.CollectionId == DefaultCollectionId && state.StableKey == stableKey)
            .Select(state => state.Note)
            .SingleAsync();
    }

    public async Task<(Guid SessionId, string StableKey)> SeedLegacyCoverImportAsync(Guid releaseId, string state)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        DateTimeOffset now = DateTimeOffset.UtcNow;
        var sessionId = ReleaseImportSessionId.New();
        var draftId = ReleaseImportDraftId.New();
        var session = ReleaseImportSession.Create(DefaultCollectionId, sessionId, "/music/covers", now);
        var draft = ReleaseImportDraft.Create(DefaultCollectionId, sessionId, draftId, "/music/covers/album", "album");
        var issue = new ImportReviewIssue("import.cover_multiple_candidates", "Multiple cover image candidates were found");
        draft.UpdateEditableFields(new ReleaseImportDraftEditableFields(
            "Legacy Cover Import", "album", Optional.Missing<string>(), Optional.Missing<string>(),
            Optional.Missing<DateOnly>(), Optional.From(2026), false, false, Optional.From("/music/covers/album/cover.jpg"),
            ["Cover Artist"], [], [], [], [], [], true,
            [issue, new ImportReviewIssue("release_import.cover_too_large", "Selected cover image is too large to attach to the import draft")]));
        draft.Confirm(new ReleaseId(releaseId));
        session.UpdateCounts(1, 0, 0, 0, now);
        session.Complete(now);
        _ = context.ReleaseImportSessions.Add(session);
        _ = context.ReleaseImportDrafts.Add(draft);

        ReviewWorkbenchSignalTarget[] targets =
        [
            new() { Kind = "release", Id = releaseId, Title = draft.Title },
            new() { Kind = "importSession", Id = sessionId.Value, Title = "Import session: /music/covers" }
        ];
        string stableKey = ReviewWorkbenchStableKey.Create(DefaultCollectionId, "importCleanup", "confirmedImportWarnings",
            "importReview", targets, $"{draftId.Value:D}|{issue.Code}|{issue.Message}");
        if (state != "unpersisted")
        {
            var persisted = CollectionReviewIssueState.Create(DefaultCollectionId, CollectionReviewIssueStateId.New(),
                new CollectionReviewIssueSnapshot
                {
                    StableKey = stableKey,
                    Category = "importCleanup",
                    Subtype = "confirmedImportWarnings",
                    Title = $"Import warning: {draft.Title} - {issue.Message}",
                    SourceDetector = "importReview",
                    TargetsJson = JsonSerializer.Serialize(targets, JsonSerializerOptions.Web)
                }, now);
            switch (state)
            {
                case "open":
                    break;
                case "reopened":
                    persisted.Reopen(now, "Keep cover decision");
                    break;
                case "dismissed":
                    persisted.Dismiss(now, "Keep cover decision");
                    break;
                case "resolved":
                    persisted.ResolveByUser(now, "Keep cover decision");
                    break;
                default:
                    throw new ArgumentOutOfRangeException(nameof(state), state, "Unsupported review fixture state");
            }
            _ = context.CollectionReviewIssueStates.Add(persisted);
        }
        _ = await context.SaveChangesAsync();
        return (sessionId.Value, stableKey);
    }
}
