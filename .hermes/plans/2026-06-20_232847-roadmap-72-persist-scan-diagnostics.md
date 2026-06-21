# Roadmap 72 Persist Scan Diagnostics Implementation Plan

> **For Hermes:** Implement this issue with strict TDD. The user confirmed backwards compatibility with pre-diagnostics desktop payloads is not required.

**Goal:** Persist structured desktop scan diagnostics on import sessions and expose both raw diagnostics and grouped summaries through the import session API.

**Architecture:** Use a dedicated `release_import_scan_diagnostics` child table scoped by collection and import session. Desktop scan requests must include `diagnostics`; the API normalizes and persists them when creating the import session. Detail/list responses expose persisted diagnostics so import review can explain what was seen, skipped, or degraded after reload.

**Tech Stack:** ASP.NET Core minimal API, EF Core SQLite, xUnit integration/domain/infrastructure tests.

---

## Current context

- Branch: `roadmap/import-hardening-loose-files`.
- Issue: `Fredoq/discweave#53` / Roadmap 72.
- Prior commit `6616b45` already added Electron scanner diagnostics and frontend request typing.
- API currently accepts only `SourceRoot`, `Files`, and `IgnoredFileCount` in `DesktopFolderScanRequest`.
- Domain currently stores only import session counts in `ReleaseImportSession`.
- The accepted direction is **not backwards compatible**: desktop scan payloads should include diagnostics explicitly.

## Design decisions

1. Persist diagnostics in a child table, not as one JSON blob, because Roadmap 73 UI and later filters need grouping by code/severity.
2. Keep diagnostics separate from catalog data. They must never create `Release`, `Track`, `OwnedItem`, `LocalAudioFile`, or `DigitalTrackFileLink` rows.
3. Use explicit severity enum values: `Info`, `Warning`, `Error`.
4. Detail response returns raw diagnostics and grouped summary. List response may include the same grouped summary for cards/table counts.
5. `IgnoredFileCount` remains as a count field, but old scan payloads that omit `diagnostics` are not supported.

## Files likely to change

- Create: `api/src/DiscWeave.Domain/SharedKernel/Ids/ReleaseImportScanDiagnosticId.cs`
- Create: `api/src/DiscWeave.Domain/Imports/ReleaseImportScanDiagnostic.cs`
- Create: `api/src/DiscWeave.Domain/Imports/ReleaseImportScanDiagnosticSeverity.cs`
- Create: `api/src/DiscWeave.Api/Features/Imports/DesktopFolderScanDiagnosticRequest.cs`
- Create: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportScanDiagnosticResponse.cs`
- Create: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportScanDiagnosticSummaryResponse.cs`
- Create: `api/src/DiscWeave.Infrastructure/Persistence/Configurations/ReleaseImportScanDiagnosticConfiguration.cs`
- Create: `api/src/DiscWeave.Infrastructure/Persistence/SqliteSchemaUpgrader.ImportDiagnostics.cs`
- Test: `api/tests/DiscWeave.Domain.Tests/Imports/ReleaseImportScanDiagnosticTests.cs`
- Test: `api/tests/DiscWeave.Infrastructure.Tests/ReleaseImportScanDiagnosticPersistenceTests.cs`
- Test: `api/tests/DiscWeave.Infrastructure.Tests/SqliteSchemaUpgraderTests.ImportDiagnostics.cs`
- Modify: `api/src/DiscWeave.Api/Features/Imports/DesktopFolderScanRequest.cs`
- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportScanService.cs`
- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportResponseMapper.cs`
- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportSessionResponse.cs`
- Modify: `api/src/DiscWeave.Infrastructure/Persistence/DiscWeaveDbContext.cs`
- Modify: `api/src/DiscWeave.Api/Program.cs`
- Modify: existing desktop import endpoint tests.

## TDD steps

### Task 1: Domain diagnostic validation

1. Add failing tests for creating a scan diagnostic with trimmed fields and severity normalization.
2. Add failing tests for required `code`, `message`, `filePath`, `relativePath`, `source` and defined severity.
3. Implement domain id, enum, and entity minimally.
4. Run domain tests.

Command:

```bash
dotnet test tests/DiscWeave.Domain.Tests/DiscWeave.Domain.Tests.csproj --filter ReleaseImportScanDiagnostic
```

### Task 2: EF persistence and collection isolation

1. Add failing infrastructure tests proving diagnostics persist/reload with all fields.
2. Add failing filtered-context test proving collection isolation.
3. Add failing cascade test proving deleting an import session deletes diagnostics.
4. Implement `DbSet`, EF configuration, query filter, and relationships.
5. Run infrastructure targeted tests.

Command:

```bash
dotnet test tests/DiscWeave.Infrastructure.Tests/DiscWeave.Infrastructure.Tests.csproj --filter ReleaseImportScanDiagnostic
```

### Task 3: SQLite upgrade table

1. Add failing upgrader test for table columns, indexes, and insert against a minimal existing schema.
2. Implement `EnsureReleaseImportScanDiagnosticsTableAsync`.
3. Add Program startup call after `EnsureReleaseImportRelationSuggestionsTableAsync`.
4. Run upgrader targeted tests.

Command:

```bash
dotnet test tests/DiscWeave.Infrastructure.Tests/DiscWeave.Infrastructure.Tests.csproj --filter Sqlite_schema_upgrade_creates_import_scan_diagnostics_table
```

### Task 4: API request and response shape

1. Add failing endpoint test: POST desktop scan with diagnostics, then GET `/api/imports/{sessionId}` returns raw diagnostics and grouped summaries after reload.
2. Add failing endpoint assertion that catalog/link tables remain empty for diagnostics-only scan.
3. Update request DTO and scan service to persist diagnostics.
4. Update response records and mapper to include raw diagnostics and grouped summary.
5. Run API targeted tests.

Command:

```bash
dotnet test tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter DesktopImportEndpointTests
```

### Task 5: Full verification and commit

Run:

```bash
dotnet test
npm run typecheck
npm run lint
npm run format:check
npm test
```

Then commit:

```bash
git add api .hermes/plans/2026-06-20_232847-roadmap-72-persist-scan-diagnostics.md
git commit -m "feat: persist import scan diagnostics"
```

## Risks

- EF composite keys must match existing import session alternate keys.
- SQLite upgrade table should work for existing local DBs where import session table already exists.
- API response additions may require frontend TypeScript type updates later, but UI display is Roadmap 73.
