using DiscWeave.Domain.Catalog;
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
    public async Task<(Guid LabelId, Guid SessionId, Guid ExternalSessionId)> SeedLabelImportsAsync()
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        var label = Label.Create(DefaultCollectionId, LabelId.New(), "Example label");
        var session = ReleaseImportSession.CreateLocalFiles(DefaultCollectionId, ReleaseImportSessionId.New(), "/Music/Example", DateTimeOffset.UtcNow);
        var external = ReleaseImportSession.CreateExternalMetadata(DefaultCollectionId, ReleaseImportSessionId.New(), "external-test", new string('a', 64), DateTimeOffset.UtcNow);
        _ = context.Labels.Add(label);
        context.ReleaseImportSessions.AddRange(session, external);
        var pending = ReleaseImportDraft.Create(DefaultCollectionId, session.Id, ReleaseImportDraftId.New(), "/Music/Example/Pending", "Pending");
        var skipped = ReleaseImportDraft.Create(DefaultCollectionId, session.Id, ReleaseImportDraftId.New(), "/Music/Example/Skipped", "Skipped");
        skipped.Skip();
        context.ReleaseImportDrafts.AddRange(pending, skipped);
        var fields = new LooseFileCandidateFields("/Music/Example/loose.flac", "loose.flac", AudioFileFormat.Flac, 100, DateTimeOffset.UtcNow, null, null, null, null, null, null, null, null, [], null, [], null, "Unmatched");
        _ = context.ReleaseImportLooseFileCandidates.Add(ReleaseImportLooseFileCandidate.Create(DefaultCollectionId, session.Id, ReleaseImportLooseFileCandidateId.New(), fields, DateTimeOffset.UtcNow));
        _ = await context.SaveChangesAsync();
        return (label.Id.Value, session.Id.Value, external.Id.Value);
    }

    public async Task CompleteLabelImportMaterialsAsync(Guid sessionId)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        var session = new ReleaseImportSessionId(sessionId);
        ReleaseImportDraft draft = await context.ReleaseImportDrafts.SingleAsync(item => item.SessionId == session && item.Status == ReleaseImportDraftStatus.NeedsReview);
        var release = Release.Create(DefaultCollectionId, ReleaseId.New(), "Reviewed release");
        draft.UpdateEditableFields(new ReleaseImportDraftEditableFields(
            "Reviewed release", "unknown", Optional.Missing<string>(), Optional.Missing<string>(),
            Optional.Missing<DateOnly>(), Optional.From(2022), true, false, Optional.Missing<string>(),
            [], [], [], [], [], [], true, []));
        draft.Confirm(release.Id);
        ReleaseImportLooseFileCandidate loose = await context.ReleaseImportLooseFileCandidates.SingleAsync(item => item.SessionId == session);
        loose.MarkConvertedToDraft(draft.Id, DateTimeOffset.UtcNow);
        _ = context.Releases.Add(release);
        _ = await context.SaveChangesAsync();
    }

    public async Task<Guid> SeedAnotherLabelImportSessionAsync()
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        var session = ReleaseImportSession.CreateLocalFiles(DefaultCollectionId, ReleaseImportSessionId.New(), "/Music/Another", DateTimeOffset.UtcNow);
        _ = context.ReleaseImportSessions.Add(session);
        _ = await context.SaveChangesAsync();
        return session.Id.Value;
    }

    public async Task DeleteLabelImportSourceAsync(Guid sessionId)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        _ = await context.ReleaseImportSessions.Where(session => session.Id == new ReleaseImportSessionId(sessionId)).ExecuteDeleteAsync();
    }

    public async Task ArchiveLabelImportSourceAsync(Guid sessionId)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        ReleaseImportSession session = await context.ReleaseImportSessions.SingleAsync(item => item.Id == new ReleaseImportSessionId(sessionId));
        session.Archive(DateTimeOffset.UtcNow);
        _ = await context.SaveChangesAsync();
    }

    public async Task ApplyLabelImportUpgradeToSyntheticDatabaseAsync()
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        int sessionsBefore = await context.ReleaseImportSessions.CountAsync();
        int draftsBefore = await context.ReleaseImportDrafts.CountAsync();
        _ = await context.Database.ExecuteSqlRawAsync("DROP TABLE label_import_session_links");
        string script = File.ReadAllText(Path.Combine(Architecture.RepositoryRoot.Find().FullName, "docs", "backup", "add-label-import-session-links.sql"));
        _ = await context.Database.ExecuteSqlRawAsync(script);
        Assert.Equal(sessionsBefore, await context.ReleaseImportSessions.CountAsync());
        Assert.Equal(draftsBefore, await context.ReleaseImportDrafts.CountAsync());
        Assert.Empty(await context.LabelImportSessionLinks.ToArrayAsync());
    }

    public async Task AssertLabelImportForeignKeysAsync(Guid labelId, Guid sessionId, Guid externalId)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        var foreign = MusicCollection.Create(CollectionId.New(), UserId.New(), "Other collection");
        var foreignLabel = Label.Create(foreign.Id, LabelId.New(), "Foreign label");
        _ = context.MusicCollections.Add(foreign);
        _ = context.Labels.Add(foreignLabel);
        _ = await context.SaveChangesAsync();
        _ = await Assert.ThrowsAsync<Microsoft.Data.Sqlite.SqliteException>(() => context.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO label_import_session_links (collection_id,label_id,session_id,source_kind) VALUES ({DefaultCollectionId.Value},{foreignLabel.Id.Value},{sessionId},'LocalFiles')"));
        _ = await Assert.ThrowsAsync<Microsoft.Data.Sqlite.SqliteException>(() => context.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO label_import_session_links (collection_id,label_id,session_id,source_kind) VALUES ({DefaultCollectionId.Value},{labelId},{externalId},'LocalFiles')"));
    }
}
