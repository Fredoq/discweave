# Loose Import Review Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved right-side loose file review workspace, keep import provenance out of user tags, and let reviewed loose metadata drive draft creation.

**Architecture:** Keep loose-file selection and derived review metadata in a focused frontend hook shared by the right-side review panel and the compact legacy panel. Extend the existing loose draft endpoint with optional reviewed title and reviewed album artists instead of adding a new workflow endpoint. Keep backend loose-file classification strict; this plan does not make album-title variants compatible.

**Tech Stack:** ASP.NET Core minimal APIs, EF Core, C# records, React, TypeScript, Vite, Vitest, Testing Library, existing DiscWeave CSS variables and panel patterns.

---

## File Structure

- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportLooseFileDraftRequest.cs`
  - Add optional `ReviewedTitle` and `ReviewedArtistNames` fields to the loose draft request.
- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportsEndpointRouteBuilderExtensions.LooseDrafts.cs`
  - Pass the whole request to the scan service instead of only `CandidateIds`.
- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportScanService.LooseDrafts.cs`
  - Normalize reviewed metadata, remove automatic user tags, and apply reviewed values when creating `ReleaseFolderScanDraft`.
- Modify: `api/tests/DiscWeave.Api.Tests/DesktopImportLooseFileDraftTests.cs`
  - Add regression tests for reviewed title and no automatic loose import tags.
- Modify: `app/src/features/catalog/api/importsExportsClient.ts`
  - Change `createImportDraftFromLooseFiles` to accept a request object with optional reviewed metadata.
- Modify: `app/src/features/catalog/api/catalogImportTypes.ts`
  - Add a request type for loose draft creation.
- Modify: `app/src/features/imports/useImportsWorkspaceController.ts`
  - Accept the new loose draft request from the view and pass it to the API client.
- Create: `app/src/features/imports/useLooseFileReviewState.ts`
  - Own selection, filtering, counts, grouping, conflict choices, provisional title, and reviewed title.
- Create: `app/src/features/imports/LooseFileReviewPanel.tsx`
  - Render the primary right-side review workspace from the selected session's loose candidates.
- Modify: `app/src/features/imports/ImportLooseFilesPanel.tsx`
  - Reuse exported helpers where practical and add a compact summary mode for the left column.
- Modify: `app/src/features/imports/ImportsWorkspaceView.tsx`
  - Route loose-only sessions with no selected draft to `LooseFileReviewPanel` instead of the empty detail panel, and demote the left loose panel.
- Modify: `app/src/features/imports/imports-loose-files.css`
  - Add right workspace layout, compact rows, conflict controls, and pill count badges.
- Modify: `app/src/features/imports/imports.css`
  - Slightly rebalance import columns so the right workspace has enough width.
- Modify: `app/src/App.imports-loose-files.test.tsx`
  - Update expectations for the right loose review workspace, reviewed title request payload, and empty tags.

## Task 1: Backend Loose Draft Contract

**Files:**
- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportLooseFileDraftRequest.cs`
- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportsEndpointRouteBuilderExtensions.LooseDrafts.cs`
- Modify: `api/src/DiscWeave.Api/Features/Imports/ReleaseImportScanService.LooseDrafts.cs`
- Test: `api/tests/DiscWeave.Api.Tests/DesktopImportLooseFileDraftTests.cs`

- [ ] **Step 1: Add failing API tests**

Add two tests to `DesktopImportLooseFileDraftTests.cs` before `Loose_draft_creation_rejects_already_consumed_candidates`:

```csharp
[Fact(DisplayName = "Loose draft creation uses reviewed release metadata")]
public async Task Loose_draft_creation_uses_reviewed_release_metadata()
{
    using var root = TempImportRoot.Create();
    string firstPath = Path.Combine(root.Path, "01 First.flac");
    string secondPath = Path.Combine(root.Path, "02 Second.flac");
    await File.WriteAllTextAsync(firstPath, "fake flac 1");
    await File.WriteAllTextAsync(secondPath, "fake flac 2");
    await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
    HttpClient client = await host.CreateAuthenticatedClientAsync();
    using JsonDocument scanDocument = await PostLooseScanAsync(
        client,
        root.Path,
        LooseAudioFileWithTags(root.Path, firstPath, "first-hash", title: "First", artists: ["Track Artist"], albumTitle: "Album A", albumArtists: ["Artist A"], trackNumber: 1),
        LooseAudioFileWithTags(root.Path, secondPath, "second-hash", title: "Second", artists: ["Track Artist"], albumTitle: "Album B", albumArtists: ["Artist B"], trackNumber: 2));
    Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
    Guid[] candidateIds = [.. scanDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray().Select(candidate => candidate.GetProperty("id").GetGuid())];

    using HttpResponseMessage response = await client.PostAsJsonAsync(
        $"/api/imports/{sessionId}/loose-file-drafts",
        new { candidateIds, reviewedTitle = "Reviewed Album", reviewedArtistNames = new[] { "Reviewed Artist" } });
    using JsonDocument document = await ReadJsonAsync(response);

    Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    JsonElement draft = Assert.Single(document.RootElement.GetProperty("drafts").EnumerateArray());
    Assert.Equal("Reviewed Album", draft.GetProperty("title").GetString());
    Assert.Equal("Reviewed Artist", draft.GetProperty("artistNames")[0].GetString());
    Assert.Contains(
        draft.GetProperty("issues").EnumerateArray(),
        issue => issue.GetProperty("code").GetString() == "release_import.loose_file_album_tag_conflict");
}

[Fact(DisplayName = "Loose draft creation does not write import origin as user tags")]
public async Task Loose_draft_creation_does_not_write_import_origin_as_user_tags()
{
    using var root = TempImportRoot.Create();
    string firstPath = Path.Combine(root.Path, "01 First.flac");
    string secondPath = Path.Combine(root.Path, "02 Second.flac");
    await File.WriteAllTextAsync(firstPath, "fake flac 1");
    await File.WriteAllTextAsync(secondPath, "fake flac 2");
    await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
    HttpClient client = await host.CreateAuthenticatedClientAsync();
    using JsonDocument scanDocument = await PostLooseScanAsync(
        client,
        root.Path,
        LooseAudioFileWithTags(root.Path, firstPath, "first-hash", title: "First", albumTitle: "Loose Album", trackNumber: 1),
        LooseAudioFileWithTags(root.Path, secondPath, "second-hash", title: "Second", albumTitle: "Loose Album", trackNumber: 2));
    Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
    Guid[] candidateIds = [.. scanDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray().Select(candidate => candidate.GetProperty("id").GetGuid())];

    using HttpResponseMessage response = await client.PostAsJsonAsync(
        $"/api/imports/{sessionId}/loose-file-drafts",
        new { candidateIds });
    using JsonDocument document = await ReadJsonAsync(response);

    Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    JsonElement draft = Assert.Single(document.RootElement.GetProperty("drafts").EnumerateArray());
    Assert.Empty(draft.GetProperty("tags").EnumerateArray());
}
```

- [ ] **Step 2: Run the focused API tests and confirm failure**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~DesktopImportEndpointTests" --no-restore
```

Expected before implementation: FAIL because `reviewedTitle` is ignored and loose draft tags still include `local-import` and `loose-files`.

- [ ] **Step 3: Extend the request record**

Replace `ReleaseImportLooseFileDraftRequest.cs` with:

```csharp
namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportLooseFileDraftRequest(
    IReadOnlyList<Guid>? CandidateIds,
    string? ReviewedTitle,
    IReadOnlyList<string>? ReviewedArtistNames);
```

- [ ] **Step 4: Pass the request to the service**

In `ReleaseImportsEndpointRouteBuilderExtensions.LooseDrafts.cs`, replace the service call arguments:

```csharp
ReleaseImportSession? session = await ReleaseImportScanService.CreateDraftFromLooseFilesAsync(
    sessionId,
    request,
    context,
    currentCollection.CollectionId,
    cancellationToken);
```

- [ ] **Step 5: Apply reviewed metadata and remove automatic tags**

In `ReleaseImportScanService.LooseDrafts.cs`:

1. Change `CreateDraftFromLooseFilesAsync` to accept `ReleaseImportLooseFileDraftRequest request`.
2. Derive requested IDs from `request.CandidateIds`.
3. Pass `request` to `ToLooseReleaseDraft`.
4. Change `ToLooseReleaseDraft` to use reviewed title and artists.
5. Change tags from `["local-import", "loose-files"]` to `[]`.

The key implementation should look like:

```csharp
public static async Task<ReleaseImportSession?> CreateDraftFromLooseFilesAsync(
    Guid sessionGuid,
    ReleaseImportLooseFileDraftRequest request,
    DiscWeaveDbContext context,
    CollectionId collectionId,
    CancellationToken cancellationToken)
{
    Guid[] requestedIds = [.. (request.CandidateIds ?? [])
        .Where(id => id != Guid.Empty)
        .Distinct()];
    // existing validation and loading code stays the same

    ReleaseFolderScanDraft scannedDraft = ToLooseReleaseDraft(session, orderedCandidates, request);
    // existing persistence code stays the same
}

private static ReleaseFolderScanDraft ToLooseReleaseDraft(
    ReleaseImportSession session,
    IReadOnlyList<ReleaseImportLooseFileCandidate> candidates,
    ReleaseImportLooseFileDraftRequest request)
{
    string draftTitle = TrimOrNull(request.ReviewedTitle) ?? DraftTitle(candidates);
    IReadOnlyList<string> artistNames = ReviewedArtistNames(request) ?? DraftArtistNames(candidates);
    IReadOnlyList<ImportReviewIssue> issues = DraftIssues(candidates);
    string relativePath = DraftRelativePath(candidates);

    return new ReleaseFolderScanDraft(
        session.SourceRoot,
        relativePath,
        draftTitle,
        "unknown",
        null,
        null,
        null,
        null,
        false,
        false,
        null,
        artistNames,
        [],
        [],
        [],
        issues,
        null,
        [.. candidates.Select(ToLooseReleaseTrack)]);
}

private static IReadOnlyList<string>? ReviewedArtistNames(ReleaseImportLooseFileDraftRequest request)
{
    string[] names =
    [
        .. (request.ReviewedArtistNames ?? [])
            .Select(TrimOrNull)
            .Where(name => name is not null)
            .Select(name => name!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
    ];

    return names.Length > 0 ? names : null;
}
```

- [ ] **Step 6: Run the focused API tests and commit**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~DesktopImportEndpointTests" --no-restore
git diff --check
git add api/src/DiscWeave.Api/Features/Imports/ReleaseImportLooseFileDraftRequest.cs api/src/DiscWeave.Api/Features/Imports/ReleaseImportsEndpointRouteBuilderExtensions.LooseDrafts.cs api/src/DiscWeave.Api/Features/Imports/ReleaseImportScanService.LooseDrafts.cs api/tests/DiscWeave.Api.Tests/DesktopImportLooseFileDraftTests.cs
git commit -m "fix: apply reviewed loose draft metadata"
```

Expected: tests pass, whitespace check passes, commit succeeds.

## Task 2: Frontend API Request Shape

**Files:**
- Modify: `app/src/features/catalog/api/catalogImportTypes.ts`
- Modify: `app/src/features/catalog/api/importsExportsClient.ts`
- Modify: `app/src/features/imports/useImportsWorkspaceController.ts`
- Test: `app/src/App.imports-loose-files.test.tsx`

- [ ] **Step 1: Add the TypeScript request type**

Add near `ReleaseImportLooseFileCandidate` in `catalogImportTypes.ts`:

```ts
export type CreateLooseFileDraftRequest = {
  candidateIds: string[]
  reviewedTitle?: string | null
  reviewedArtistNames?: string[] | null
}
```

- [ ] **Step 2: Change the API client**

In `importsExportsClient.ts`, import `CreateLooseFileDraftRequest` and replace `createImportDraftFromLooseFiles` with:

```ts
export async function createImportDraftFromLooseFiles(
  sessionId: string,
  request: CreateLooseFileDraftRequest,
) {
  return sendJson<ReleaseImportSession>(
    `/api/imports/${sessionId}/loose-file-drafts`,
    'POST',
    {
      candidateIds: request.candidateIds,
      reviewedTitle: request.reviewedTitle ?? null,
      reviewedArtistNames: request.reviewedArtistNames ?? null,
    },
  )
}
```

- [ ] **Step 3: Change the workspace action signature**

In `useImportsWorkspaceController.ts`, import `CreateLooseFileDraftRequest` and replace:

```ts
async function createLooseFileDraft(candidateIds: string[]) {
```

with:

```ts
async function createLooseFileDraft(request: CreateLooseFileDraftRequest) {
  const candidateIds = request.candidateIds
```

Then replace the API call with:

```ts
const session = await createImportDraftFromLooseFiles(
  selectedSession.id,
  request,
)
```

- [ ] **Step 4: Update the existing frontend test payload expectation**

In `App.imports-loose-files.test.tsx`, change the existing loose draft fixture tags:

```ts
tags: [],
```

and change the request payload expectation to include nullable reviewed metadata:

```ts
expect(JSON.parse(typeof requestBody === 'string' ? requestBody : '{}')).toEqual({
  candidateIds: ['loose-1'],
  reviewedTitle: 'Loose Album',
  reviewedArtistNames: ['Loose Album Artist'],
})
```

- [ ] **Step 5: Run the focused frontend tests and commit**

Run:

```bash
npm test -- App.imports-loose-files.test.tsx
npm run typecheck
git diff --check
git add app/src/features/catalog/api/catalogImportTypes.ts app/src/features/catalog/api/importsExportsClient.ts app/src/features/imports/useImportsWorkspaceController.ts app/src/App.imports-loose-files.test.tsx
git commit -m "feat: send reviewed loose draft metadata"
```

Expected before the next task: tests may still fail until the review state supplies reviewed metadata. Do not commit until the focused tests and typecheck pass.

## Task 3: Shared Loose Review State

**Files:**
- Create: `app/src/features/imports/useLooseFileReviewState.ts`
- Modify: `app/src/features/imports/ImportLooseFilesPanel.tsx`
- Test: `app/src/App.imports-loose-files.test.tsx`

- [ ] **Step 1: Create the shared hook**

Create `useLooseFileReviewState.ts` with:

```ts
import { useMemo, useState } from 'react'
import type {
  CreateLooseFileDraftRequest,
  ReleaseImportLooseFileCandidate,
} from '../catalog/catalogApi'

export const looseFileFilters = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'ignored', label: 'Ignored' },
  { id: 'consumed', label: 'Consumed / converted' },
  { id: 'hasMetadata', label: 'Has metadata' },
  { id: 'missingHash', label: 'Missing hash' },
] as const

export type LooseFileFilter = (typeof looseFileFilters)[number]['id']

export const terminalLooseFileDecisions = new Set([
  'consumed',
  'converted',
  'convertedToDraft',
  'attachedToRelease',
])

export function useLooseFileReviewState(
  candidates: ReleaseImportLooseFileCandidate[] | null | undefined,
) {
  const looseFiles = useMemo(() => candidates ?? [], [candidates])
  const pendingCandidates = useMemo(
    () => looseFiles.filter((candidate) => candidate.decision === 'pending'),
    [looseFiles],
  )
  const [activeFilter, setActiveFilter] = useState<LooseFileFilter>('all')
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([])
  const [reviewedTitle, setReviewedTitle] = useState('')
  const [reviewedArtistNames, setReviewedArtistNames] = useState<string[]>([])
  const selectedPendingIds = useMemo(
    () =>
      selectedCandidateIds.filter((candidateId) =>
        pendingCandidates.some((candidate) => candidate.id === candidateId),
      ),
    [pendingCandidates, selectedCandidateIds],
  )
  const selectedPendingCandidates = useMemo(
    () =>
      pendingCandidates.filter((candidate) =>
        selectedPendingIds.includes(candidate.id),
      ),
    [pendingCandidates, selectedPendingIds],
  )
  const reviewCandidates =
    selectedPendingCandidates.length > 0
      ? selectedPendingCandidates
      : pendingCandidates
  const albumTitleOptions = useMemo(
    () => countDistinctHints(reviewCandidates.map((candidate) => candidate.albumTitleHint)),
    [reviewCandidates],
  )
  const albumArtistOptions = useMemo(
    () => countDistinctHints(reviewCandidates.flatMap((candidate) => candidate.albumArtistHints)),
    [reviewCandidates],
  )
  const provisionalTitle = useMemo(
    () => reviewedTitle || albumTitleOptions[0]?.value || commonFolderName(reviewCandidates) || 'Loose files',
    [albumTitleOptions, reviewedTitle, reviewCandidates],
  )
  const filteredCandidates = useMemo(
    () => looseFiles.filter((candidate) => matchesFilter(candidate, activeFilter)),
    [activeFilter, looseFiles],
  )
  const groups = useMemo(() => groupByReason(filteredCandidates), [filteredCandidates])

  function toggleCandidate(candidateId: string) {
    setSelectedCandidateIds((currentIds) =>
      currentIds.includes(candidateId)
        ? currentIds.filter((id) => id !== candidateId)
        : [...currentIds, candidateId],
    )
  }

  function selectAllPending() {
    setSelectedCandidateIds(pendingCandidates.map((candidate) => candidate.id))
  }

  function clearSelection() {
    setSelectedCandidateIds([])
  }

  function toDraftRequest(): CreateLooseFileDraftRequest {
    return {
      candidateIds: selectedPendingIds,
      reviewedTitle: (reviewedTitle || provisionalTitle).trim() || null,
      reviewedArtistNames:
        reviewedArtistNames.length > 0 ? reviewedArtistNames : null,
    }
  }

  return {
    activeFilter,
    albumArtistOptions,
    albumTitleOptions,
    clearSelection,
    filteredCandidates,
    groups,
    looseFiles,
    pendingCandidates,
    provisionalTitle,
    reviewCandidates,
    reviewedArtistNames,
    reviewedTitle,
    selectedPendingIds,
    selectedPendingIdSet: new Set(selectedPendingIds),
    setActiveFilter,
    setReviewedArtistNames,
    setReviewedTitle,
    selectAllPending,
    toDraftRequest,
    toggleCandidate,
  }
}
```

Also move or re-export the existing `matchesFilter`, `filterCount`, `groupByReason`, `hasMetadata`, `humanizeToken`, `formatBytes`, `formatDuration`, and `joinHints` helpers from `ImportLooseFilesPanel.tsx` into this hook file.

- [ ] **Step 2: Update the existing loose panel to import helpers**

In `ImportLooseFilesPanel.tsx`, remove local duplicate constants/helpers that now live in `useLooseFileReviewState.ts` and import them:

```ts
import {
  decisionBadgeClass,
  filterCount,
  formatBytes,
  formatDuration,
  humanizeToken,
  joinHints,
  looseFileFilters,
  useLooseFileReviewState,
} from './useLooseFileReviewState'
```

Keep `LooseFileCandidateCard` exportable:

```ts
export function LooseFileCandidateCard(...)
```

Use `const review = useLooseFileReviewState(candidates)` and replace local state references with `review.*`.

- [ ] **Step 3: Run frontend tests**

Run:

```bash
npm test -- App.imports-loose-files.test.tsx
npm run typecheck
```

Expected: tests pass with the current left-panel behavior before adding the right workspace.

## Task 4: Right-Side Loose Review Workspace

**Files:**
- Create: `app/src/features/imports/LooseFileReviewPanel.tsx`
- Modify: `app/src/features/imports/ImportsWorkspaceView.tsx`
- Modify: `app/src/App.imports-loose-files.test.tsx`

- [ ] **Step 1: Add tests for the right-side workspace**

Update the second test in `App.imports-loose-files.test.tsx` to expect:

```ts
expect(
  await h.screen.findByRole('heading', { name: 'Loose file review' }),
).toBeInTheDocument()
expect(
  h.screen.queryByRole('heading', { name: 'No release draft selected' }),
).not.toBeInTheDocument()
expect(
  h.screen.getByText(
    'These files are staged scan metadata. Review the release context before creating a draft or attaching files to an existing release.',
  ),
).toBeInTheDocument()
expect(h.screen.getByText('4 total')).toBeInTheDocument()
expect(h.screen.getByText('2 pending')).toBeInTheDocument()
```

Add a new interaction test that selects all pending files, chooses `Mixed Album A`, and verifies the POST body contains reviewed metadata:

```ts
await user.click(h.screen.getByRole('button', { name: /select all pending/i }))
await user.click(h.screen.getByRole('button', { name: /use mixed album a/i }))
await user.click(h.screen.getByRole('button', { name: /^create release draft$/i }))

expect(jsonRequestBody(createCall?.[1]).reviewedTitle).toBe('Mixed Album A')
```

- [ ] **Step 2: Create `LooseFileReviewPanel.tsx`**

Implement the panel with these props:

```ts
type LooseFileReviewPanelProps = Readonly<{
  candidates: ReleaseImportLooseFileCandidate[] | null | undefined
  isAttaching?: boolean
  isCreatingDraft?: boolean
  onCreateDraft: (request: CreateLooseFileDraftRequest) => void
  onStartAttach: (candidateIds: string[]) => void
}>
```

The component should:

- call `useLooseFileReviewState(candidates)`;
- render heading `Loose file review`;
- render metrics as text badges: total, pending, selected, converted, ignored;
- render top action buttons;
- show `Resolve release title` when `albumTitleOptions.length > 1`;
- show album title option buttons with accessible labels like `Use Mixed Album A`;
- show an editable final release title input labeled `Final release title`;
- show compact candidate rows grouped by reason;
- call `onCreateDraft(review.toDraftRequest())`;
- call `onStartAttach(review.selectedPendingIds)`.

- [ ] **Step 3: Route loose-only sessions to the review workspace**

In `ImportsWorkspaceView.tsx`, compute:

```ts
const shouldShowLooseReview =
  selectedSessionHasLooseFiles && !draft && !hasSelectedSessionDrafts
```

Render `LooseFileReviewPanel` in the detail column when `shouldShowLooseReview` is true. Keep `DraftEditor` branch first, then loose review, then the generic empty panel.

Do not render the full `LooseFilesPanel` in the left column while `shouldShowLooseReview` is true; replace it with a compact summary or omit it.

- [ ] **Step 4: Run frontend tests and commit**

Run:

```bash
npm test -- App.imports-loose-files.test.tsx
npm run typecheck
git diff --check
git add app/src/features/imports/useLooseFileReviewState.ts app/src/features/imports/LooseFileReviewPanel.tsx app/src/features/imports/ImportLooseFilesPanel.tsx app/src/features/imports/ImportsWorkspaceView.tsx app/src/App.imports-loose-files.test.tsx
git commit -m "feat: add loose file review workspace"
```

Expected: tests pass, typecheck passes, commit succeeds.

## Task 5: Layout And Count Badge Polish

**Files:**
- Modify: `app/src/features/imports/imports-loose-files.css`
- Modify: `app/src/features/imports/imports.css`
- Test: `app/src/App.imports-loose-files.test.tsx`

- [ ] **Step 1: Convert count circles to stable pills**

In `imports-loose-files.css`, change filter/group count styles from fixed 20-24px circles to:

```css
.imports-loose-count-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  min-height: 22px;
  border-radius: 999px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 740;
  line-height: 1;
  white-space: nowrap;
}
```

Apply this class to filter count spans, group header counts, and right workspace metric counts.

- [ ] **Step 2: Add right workspace and compact row CSS**

Add classes for:

- `.imports-loose-review-panel`
- `.imports-loose-review-header`
- `.imports-loose-review-metrics`
- `.imports-loose-review-actions`
- `.imports-loose-resolution`
- `.imports-loose-option-list`
- `.imports-loose-row`
- `.imports-loose-row-main`
- `.imports-loose-row-meta`

Use existing colors and `var(--radius-md)`, keep rows compact, make status badges align with `align-self: start`, and allow long paths to wrap with `overflow-wrap: anywhere`.

- [ ] **Step 3: Rebalance columns**

In `imports.css`, change:

```css
.imports-layout {
  grid-template-columns: minmax(340px, 0.58fr) minmax(0, 1.42fr);
}
```

Keep the existing sticky `.imports-detail-column` behavior.

- [ ] **Step 4: Run checks and commit**

Run:

```bash
npm test -- App.imports-loose-files.test.tsx
npm run typecheck
git diff --check
git add app/src/features/imports/imports-loose-files.css app/src/features/imports/imports.css app/src/features/imports/LooseFileReviewPanel.tsx app/src/features/imports/ImportLooseFilesPanel.tsx
git commit -m "fix: polish loose file review layout"
```

Expected: tests and typecheck pass, no whitespace errors, commit succeeds.

## Task 6: Final Verification And Desktop Build

**Files:**
- No source edits expected.

- [ ] **Step 1: Run full targeted verification**

Run:

```bash
dotnet test api/tests/DiscWeave.Api.Tests/DiscWeave.Api.Tests.csproj --filter "FullyQualifiedName~DesktopImportEndpointTests" --no-restore
npm test -- App.imports-loose-files.test.tsx
npm run typecheck
git diff --check
```

Expected: all commands pass.

- [ ] **Step 2: Build desktop app**

Inspect `app/package.json` scripts and run the appropriate desktop build command. If the scripts expose `desktop:build`, run:

```bash
npm run desktop:build
```

If the actual script name differs, use the script from `app/package.json` and record it in the final response.

- [ ] **Step 3: Final git status**

Run:

```bash
git status --short --branch
```

Expected: current branch is `fix/import-loose-review-empty-state`; working tree is clean after commits.

## Self-Review

- Spec coverage: right column owns loose workflow in Task 4, left column is demoted in Task 4, count badges are fixed in Task 5, mixed album tag resolution is implemented in Tasks 1 and 4, draft creation uses reviewed state in Tasks 1-4, automatic tags are removed in Task 1, frontend tests cover the loose-only right state in Task 4.
- Placeholder scan: no implementation step uses TBD/TODO language; code signatures and expected payloads are concrete.
- Type consistency: frontend request type is `CreateLooseFileDraftRequest`; backend request record fields are `CandidateIds`, `ReviewedTitle`, and `ReviewedArtistNames`; JSON payload uses `candidateIds`, `reviewedTitle`, and `reviewedArtistNames`.
