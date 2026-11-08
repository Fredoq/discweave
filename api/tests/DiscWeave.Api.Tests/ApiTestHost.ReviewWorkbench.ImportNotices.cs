using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Api.Tests;

internal sealed partial class ApiTestHost
{
    public async Task<Guid> SeedConfirmedImportNoticeAsync(string code, string message)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        var release = Release.Create(DefaultCollectionId, ReleaseId.New(), "Imported release");
        release.UpdateSummary(release.Summary.WithMetadata(ReleaseMetadata.Empty.WithReleaseYear(2022)));
        var session = ReleaseImportSession.CreateLocalFiles(DefaultCollectionId,
            ReleaseImportSessionId.New(), "/music/import-notices", DateTimeOffset.UtcNow);
        var draft = ReleaseImportDraft.CreateLocalFiles(DefaultCollectionId, session.Id,
            ReleaseImportDraftId.New(), "/music/import-notices/Album", "Album");
        draft.UpdateEditableFields(new ReleaseImportDraftEditableFields(
            "Imported release", "unknown", Optional.Missing<string>(), Optional.Missing<string>(),
            Optional.Missing<DateOnly>(), Optional.From(2022), true, false, Optional.Missing<string>(),
            [], [], [], [], [], [], true,
            [new ImportReviewIssue(code, message), new ImportReviewIssue("import.control_notice", "Unrelated import notice")]));
        draft.Confirm(release.Id);
        _ = context.Releases.Add(release);
        _ = context.ReleaseImportSessions.Add(session);
        _ = context.ReleaseImportDrafts.Add(draft);
        _ = await context.SaveChangesAsync();
        return release.Id.Value;
    }
}
