# Track Digital Files As Collection Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework Track detail so digital files render as collection-derived release-copy context with per-file local edit actions.

**Architecture:** Keep the backend and DTO contracts from Roadmap 60 unchanged. Add frontend helper functions around `TrackRecord.digitalFiles`, extend the local file edit mapper to accept a selected `TrackDigitalFile`, and replace the old `Local files` detail section with a grouped `Digital files in collection` section. Tests drive shared-file reuse, different-path context, empty state, and row-level editing.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, vanilla CSS.

---

## Scope Boundaries

This plan implements GitHub issue `Fredoq/discweave#46` / Roadmap 62.

Implemented here:

- Track detail heading changes from `Local files` to `Digital files in collection`.
- Track detail always treats `track.digitalFiles` as derived collection context.
- The section shows summary counts for linked rows, unique local files, reused local files, and distinct paths.
- File rows include release-copy context, release track position, path, format, codec, quality, technical metadata, and row-level `Edit file` actions.
- Local file editing opens for the selected row's `localAudioFileId`.
- Tests cover shared `localAudioFileId`, different paths, row-level edit action, browser hidden edit actions, empty state, and existing file format filter/search behavior.

Not implemented here:

- Backend API/model changes.
- Import confirmation changes.
- Owned Items UI changes.
- Review Workbench detector changes.
- Export/restore changes.
- Automatic deduplication, merge, relinking, deletion, or loose-file import.

## File Structure

Modify:

- `app/src/features/tracks/trackDisplayHelpers.ts` - add digital file display, summary, reused-file, and different-path helpers.
- `app/src/features/tracks/TrackDetail.tsx` - replace `Local files` section with `Digital files in collection` grouped rows and per-row edit actions.
- `app/src/features/tracks/TracksWorkspace.tsx` - pass selected `TrackDigitalFile` into the local file edit mapper.
- `app/src/features/tracks/tracks.css` - add small, detail-panel scoped styles for digital file summaries and rows.
- `app/src/features/localFiles/localFileEditModel.ts` - add selected-file mapper and keep old helper as a primary-file convenience wrapper.
- `app/src/App.workspaces-tracks-playlists.test.tsx` - update Track detail UI assertions and add shared/different context coverage.
- `app/src/App.local-file-editor.test.tsx` - update local edit action tests to use row-level actions and add selected-row coverage.
- `app/src/features/localFiles/localFileEditModel.test.ts` - add focused selected-file mapper coverage.

Create:

- `app/src/features/tracks/trackDisplayHelpers.test.ts` - focused helper tests for summary and context badges.

No backend files should change.

---

### Task 1: Add Failing Digital File Context Helper Tests

**Files:**

- Create: `app/src/features/tracks/trackDisplayHelpers.test.ts`
- Test: `app/src/features/tracks/trackDisplayHelpers.test.ts`

- [ ] **Step 1: Create helper test file**

Create `app/src/features/tracks/trackDisplayHelpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  isDifferentTrackDigitalFilePath,
  isReusedTrackDigitalFile,
  trackDigitalFilePositionLabel,
  trackDigitalFileSummary,
} from './trackDisplayHelpers'
import type { TrackDigitalFile, TrackRecord } from './tracksData'

describe('trackDisplayHelpers digital file context', () => {
  it('summarizes linked rows, unique local files, reused files and paths', () => {
    const track = trackWithDigitalFiles([
      file({ localAudioFileId: 'local-shared', path: '/music/a.flac' }),
      file({
        digitalTrackFileLinkId: 'link-shared-second-copy',
        localAudioFileId: 'local-shared',
        releaseId: 'release-2',
        releaseTitle: 'Classics',
        releaseTrackId: 'release-track-2',
        position: '9',
        path: '/music/a.flac',
      }),
      file({
        digitalTrackFileLinkId: 'link-different-path',
        localAudioFileId: 'local-different',
        releaseId: 'release-3',
        releaseTitle: 'Reissue',
        releaseTrackId: 'release-track-3',
        position: 'D1',
        path: '/music/reissue/a.flac',
      }),
    ])

    expect(trackDigitalFileSummary(track)).toEqual({
      linkedFileRows: 3,
      uniqueLocalFiles: 2,
      reusedLocalFiles: 1,
      distinctPaths: 2,
      hasReusedLocalFiles: true,
      hasDifferentPaths: true,
    })
  })

  it('identifies reused local files and different paths per row', () => {
    const shared = file({ localAudioFileId: 'local-shared', path: '/music/a.flac' })
    const sharedAgain = file({
      digitalTrackFileLinkId: 'link-shared-again',
      localAudioFileId: 'local-shared',
      releaseId: 'release-2',
      releaseTitle: 'Classics',
      releaseTrackId: 'release-track-2',
      position: '9',
      path: '/music/a.flac',
    })
    const different = file({
      digitalTrackFileLinkId: 'link-different',
      localAudioFileId: 'local-different',
      releaseId: 'release-3',
      releaseTitle: 'Reissue',
      releaseTrackId: 'release-track-3',
      position: 'D1',
      path: '/music/reissue/a.flac',
    })
    const files = [shared, sharedAgain, different]

    expect(isReusedTrackDigitalFile(shared, files)).toBe(true)
    expect(isReusedTrackDigitalFile(different, files)).toBe(false)
    expect(isDifferentTrackDigitalFilePath(shared, files)).toBe(true)
    expect(isDifferentTrackDigitalFilePath(different, files)).toBe(true)
  })

  it('formats release track position with disc and side context', () => {
    expect(
      trackDigitalFilePositionLabel(
        file({ disc: 'Disc 2', side: 'B', position: '4' }),
      ),
    ).toBe('Disc 2 · Side B · Track 4')
    expect(trackDigitalFilePositionLabel(file({ position: '3' }))).toBe(
      'Track 3',
    )
  })
})

function trackWithDigitalFiles(digitalFiles: TrackDigitalFile[]): TrackRecord {
  return {
    id: 'track-a',
    title: 'Track A',
    artist: 'Artist A',
    release: {
      id: 'release-1',
      title: 'Release A',
      artist: 'Artist A',
      year: '1992',
      label: 'Label A',
    },
    trackNumber: '1',
    duration: '4:44',
    relationHint: '',
    tags: [],
    credits: [],
    releaseAppearances: [],
    relations: [],
    digitalFiles,
  }
}

function file(overrides: Partial<TrackDigitalFile> = {}): TrackDigitalFile {
  return {
    digitalTrackFileLinkId: 'link-1',
    localAudioFileId: 'local-1',
    digitalOwnedItemId: 'owned-1',
    releaseId: 'release-1',
    releaseTitle: 'Release A',
    releaseTrackId: 'release-track-1',
    position: '1',
    path: '/music/a.flac',
    format: 'FLAC',
    codec: 'FLAC',
    quality: 'Lossless',
    contentHash: 'sha256:a',
    duration: '4:44',
    bitrate: 'Lossless',
    sampleRate: '44.1 kHz / 16-bit',
    channels: 'Stereo',
    ...overrides,
  }
}
```

- [ ] **Step 2: Run helper tests to verify RED**

Run from `app/`:

```bash
npm test -- trackDisplayHelpers
```

Expected: FAIL because `trackDigitalFileSummary`, `trackDigitalFilePositionLabel`, `isReusedTrackDigitalFile`, and `isDifferentTrackDigitalFilePath` do not exist.

### Task 2: Implement Digital File Context Helpers

**Files:**

- Modify: `app/src/features/tracks/trackDisplayHelpers.ts`
- Test: `app/src/features/tracks/trackDisplayHelpers.test.ts`

- [ ] **Step 1: Add summary and context helpers**

Append these helpers to `app/src/features/tracks/trackDisplayHelpers.ts`:

```ts
export type TrackDigitalFileSummary = {
  linkedFileRows: number
  uniqueLocalFiles: number
  reusedLocalFiles: number
  distinctPaths: number
  hasReusedLocalFiles: boolean
  hasDifferentPaths: boolean
}

export function trackDigitalFileSummary(
  track: TrackRecord,
): TrackDigitalFileSummary {
  const localAudioFileIds = uniqueValues(
    track.digitalFiles
      .map((file) => file.localAudioFileId.trim())
      .filter(Boolean),
  )
  const paths = uniqueValues(
    track.digitalFiles.map((file) => normalizeFilePath(file.path)),
  )
  const reusedLocalFiles = localAudioFileIds.filter(
    (localAudioFileId) =>
      track.digitalFiles.filter(
        (file) => file.localAudioFileId === localAudioFileId,
      ).length > 1,
  ).length

  return {
    linkedFileRows: track.digitalFiles.length,
    uniqueLocalFiles: localAudioFileIds.length,
    reusedLocalFiles,
    distinctPaths: paths.length,
    hasReusedLocalFiles: reusedLocalFiles > 0,
    hasDifferentPaths: paths.length > 1,
  }
}

export function trackDigitalFilePositionLabel(file: TrackDigitalFile) {
  const context = [
    file.disc?.trim(),
    file.side?.trim() ? `Side ${file.side.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return [context, `Track ${file.position}`].filter(Boolean).join(' · ')
}

export function isReusedTrackDigitalFile(
  file: TrackDigitalFile,
  files: readonly TrackDigitalFile[],
) {
  return (
    file.localAudioFileId.trim().length > 0 &&
    files.filter(
      (candidate) => candidate.localAudioFileId === file.localAudioFileId,
    ).length > 1
  )
}

export function isDifferentTrackDigitalFilePath(
  _file: TrackDigitalFile,
  files: readonly TrackDigitalFile[],
) {
  return uniqueValues(files.map((file) => normalizeFilePath(file.path))).length > 1
}

function normalizeFilePath(path: string) {
  return path.trim().toLowerCase()
}
```

- [ ] **Step 2: Run helper tests to verify GREEN**

Run from `app/`:

```bash
npm test -- trackDisplayHelpers
```

Expected: PASS.

- [ ] **Step 3: Commit helper tests and helpers**

Run:

```bash
git add app/src/features/tracks/trackDisplayHelpers.ts app/src/features/tracks/trackDisplayHelpers.test.ts
git commit -m "test: cover track digital file context helpers"
```

Expected: commit succeeds with only helper files staged.

### Task 3: Add Selected-File Local Edit Mapper

**Files:**

- Modify: `app/src/features/localFiles/localFileEditModel.test.ts`
- Modify: `app/src/features/localFiles/localFileEditModel.ts`
- Test: `app/src/features/localFiles/localFileEditModel.test.ts`

- [ ] **Step 1: Add failing selected-file mapper test**

Append this test before the closing `})` in `app/src/features/localFiles/localFileEditModel.test.ts`:

```ts
  it('maps the selected track digital file into a local editable file', () => {
    const firstFile = editableDigitalFile(
      'local-first-file',
      '/music/first.flac',
      'sha256:first',
    )
    const selectedFile = {
      ...editableDigitalFile(
        'local-selected-file',
        '/music/selected.flac',
        'sha256:selected',
      ),
      releaseId: 'selected-release',
      releaseTitle: 'Selected Release',
      position: '7',
    }
    const track: TrackRecord = {
      id: 'multi-file-track',
      title: 'Multi File Track',
      artist: 'Archive Artist',
      release: {
        title: 'Archive Release',
        artist: 'Archive Artist',
        year: '2026',
        label: 'Archive Label',
      },
      trackNumber: '1',
      duration: '',
      relationHint: '',
      tags: [],
      credits: [],
      releaseAppearances: [],
      relations: [],
      digitalFiles: [firstFile, selectedFile],
    }

    const editableFile = localEditableFileFromTrackDigitalFile(
      track,
      selectedFile,
    )

    expect(editableFile?.localAudioFileId).toBe('local-selected-file')
    expect(editableFile?.currentPath).toBe('/music/selected.flac')
    expect(editableFile?.targetPath).toBe('/music/selected.flac')
    expect(editableFile?.position).toBe('7')
    expect(editableFile?.release.title).toBe('Selected Release')
  })
```

Update the import at the top of the same file:

```ts
import {
  localEditableFileFromTrack,
  localEditableFileFromTrackDigitalFile,
} from './localFileEditModel'
```

- [ ] **Step 2: Run local edit model tests to verify RED**

Run from `app/`:

```bash
npm test -- localFileEditModel
```

Expected: FAIL because `localEditableFileFromTrackDigitalFile` is not exported.

- [ ] **Step 3: Implement selected-file mapper**

In `app/src/features/localFiles/localFileEditModel.ts`, update the import and replace the current `localEditableFileFromTrack` function with these functions:

```ts
import {
  primaryTrackDigitalFile,
  trackArtistDisplay,
} from '../tracks/trackDisplayHelpers'
import type {
  TrackCredit,
  TrackDigitalFile,
  TrackRecord,
} from '../tracks/tracksData'
```

```ts
export function localEditableFileFromTrack(
  track: TrackRecord,
  tagRoleMappings: TagRoleMapping[] = activeTagRoleMappings,
  roleLabelsByCode: ReadonlyMap<string, string> = new Map(),
): LocalEditableFile | null {
  const digitalFile = primaryTrackDigitalFile(track)

  return digitalFile
    ? localEditableFileFromTrackDigitalFile(
        track,
        digitalFile,
        tagRoleMappings,
        roleLabelsByCode,
      )
    : null
}

export function localEditableFileFromTrackDigitalFile(
  track: TrackRecord,
  digitalFile: TrackDigitalFile,
  tagRoleMappings: TagRoleMapping[] = activeTagRoleMappings,
  roleLabelsByCode: ReadonlyMap<string, string> = new Map(),
): LocalEditableFile | null {
  if (!digitalFile.localAudioFileId) {
    return null
  }

  return {
    localAudioFileId: digitalFile.localAudioFileId,
    title: track.title,
    position: digitalFile.position || track.trackNumber,
    trackArtists: trackArtistDisplay(track),
    currentPath: digitalFile.path,
    targetPath: digitalFile.path,
    release: {
      title: digitalFile.releaseTitle || track.release.title,
      artists: track.release.artist,
      year: track.release.year,
      releaseDate: track.release.releaseDate,
      label: releaseTagLabel(track),
      catalogNumber: track.release.catalogNumber,
    },
    tags: tagsFromTrack(track, tagRoleMappings, roleLabelsByCode),
  }
}
```

- [ ] **Step 4: Run local edit model tests to verify GREEN**

Run from `app/`:

```bash
npm test -- localFileEditModel
```

Expected: PASS.

- [ ] **Step 5: Commit selected-file mapper**

Run:

```bash
git add app/src/features/localFiles/localFileEditModel.ts app/src/features/localFiles/localFileEditModel.test.ts
git commit -m "test: cover selected track file edit mapping"
```

Expected: commit succeeds with only local edit model files staged.

### Task 4: Add Failing Track Detail UI Tests

**Files:**

- Modify: `app/src/App.workspaces-tracks-playlists.test.tsx`
- Test: `app/src/App.workspaces-tracks-playlists.test.tsx`

- [ ] **Step 1: Update existing local file section test**

Rename the existing test title:

```ts
  it('shows release link, credits, relations and digital files as separate track detail sections', () => {
```

Inside that test, replace the old `Local files` assertions with:

```ts
    expect(
      h.within(detailPanel).queryByRole('heading', { name: 'Local files' }),
    ).not.toBeInTheDocument()
    expect(
      h.within(detailPanel).getByRole('heading', {
        name: 'Digital files in collection',
      }),
    ).toBeInTheDocument()
    const digitalFiles = h.detailSection(
      detailPanel,
      'Digital files in collection',
    )
    expect(h.within(digitalFiles).getByText('Linked rows')).toBeInTheDocument()
    expect(h.within(digitalFiles).getByText('Unique files')).toBeInTheDocument()
    expect(
      h.within(digitalFiles).getByText('Selected Ambient Works 85-92'),
    ).toBeInTheDocument()
    expect(h.within(digitalFiles).getAllByText('FLAC').length).toBeGreaterThan(0)
    expect(h.within(digitalFiles).getByText('44.1 kHz / 16-bit')).toBeInTheDocument()
```

- [ ] **Step 2: Add shared-file and different-path UI test**

Add this test after the updated digital files section test:

```ts
  it('shows shared local file reuse and different paths across release contexts', () => {
    window.history.pushState({}, '', '/tracks?track=multi-context-track')
    const baseFile = h.trackRecords[0].digitalFiles[0]
    h.seedCatalogForTests({
      artists: h.artistRecords,
      releases: h.releaseRecords,
      tracks: [
        {
          ...h.trackRecords[0],
          id: 'multi-context-track',
          title: 'Multi Context Track',
          digitalFiles: [
            {
              ...baseFile,
              digitalTrackFileLinkId: 'link-shared-first',
              localAudioFileId: 'local-shared-file',
              releaseId: 'selected-ambient-works-85-92',
              releaseTitle: 'Selected Ambient Works 85-92',
              releaseTrackId: 'release-track-shared-first',
              position: '3',
              path: '/archive/aphex-twin/selected-ambient-works-85-92/03-polynomial-c.flac',
            },
            {
              ...baseFile,
              digitalTrackFileLinkId: 'link-shared-second',
              localAudioFileId: 'local-shared-file',
              releaseId: 'classics',
              releaseTitle: 'Classics',
              releaseTrackId: 'release-track-shared-second',
              position: '9',
              path: '/archive/aphex-twin/selected-ambient-works-85-92/03-polynomial-c.flac',
            },
            {
              ...baseFile,
              digitalTrackFileLinkId: 'link-different-path',
              localAudioFileId: 'local-different-file',
              releaseId: 'selected-ambient-works-reissue',
              releaseTitle: 'Selected Ambient Works 85-92 Reissue',
              releaseTrackId: 'release-track-different-path',
              position: 'D1',
              path: '/archive/aphex-twin/reissue/disc-1-polynomial-c.flac',
            },
          ],
        },
      ],
      ownedItems: h.ownedItemRecords,
      relations: h.relationRecords,
      playlists: h.playlistRecords,
    })

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Multi Context Track',
    })
    const digitalFiles = h.detailSection(
      detailPanel,
      'Digital files in collection',
    )

    expect(h.within(digitalFiles).getByText('3')).toBeInTheDocument()
    expect(h.within(digitalFiles).getByText('Same local file reused')).toBeInTheDocument()
    expect(h.within(digitalFiles).getAllByText('Different file path').length).toBeGreaterThan(0)
    expect(h.within(digitalFiles).getByText('Classics')).toBeInTheDocument()
    expect(
      h.within(digitalFiles).getByText('Selected Ambient Works 85-92 Reissue'),
    ).toBeInTheDocument()
  })
```

- [ ] **Step 3: Add empty digital file section test**

Add this test after the shared/different context test:

```ts
  it('shows an empty collection-link state when a track has no digital file rows', () => {
    window.history.pushState({}, '', '/tracks?track=track-without-files')
    h.seedCatalogForTests({
      artists: h.artistRecords,
      releases: h.releaseRecords,
      tracks: [
        {
          ...h.trackRecords[0],
          id: 'track-without-files',
          title: 'Track Without Files',
          digitalFiles: [],
        },
      ],
      ownedItems: h.ownedItemRecords,
      relations: h.relationRecords,
      playlists: h.playlistRecords,
    })

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Track Without Files',
    })
    const digitalFiles = h.detailSection(
      detailPanel,
      'Digital files in collection',
    )

    expect(
      h
        .within(digitalFiles)
        .getByText(
          'No digital files linked to this track through release copies yet.',
        ),
    ).toBeVisible()
  })
```

- [ ] **Step 4: Run Track workspace tests to verify RED**

Run from `app/`:

```bash
npm test -- App.workspaces-tracks-playlists
```

Expected: FAIL because Track detail still renders `Local files`, hides the file section for tracks with no files, and does not render shared/different badges.

### Task 5: Implement Track Detail Digital Files Section

**Files:**

- Modify: `app/src/features/tracks/TrackDetail.tsx`
- Modify: `app/src/features/tracks/tracks.css`
- Test: `app/src/App.workspaces-tracks-playlists.test.tsx`

- [ ] **Step 1: Update TrackDetail imports and props**

In `app/src/features/tracks/TrackDetail.tsx`, replace the helper imports:

```ts
import {
  isDifferentTrackDigitalFilePath,
  isReusedTrackDigitalFile,
  releaseHref,
  trackArtistDisplay,
  trackDigitalFilePositionLabel,
  trackDigitalFileSummary,
  trackReleaseAppearances,
} from './trackDisplayHelpers'
```

Update `TrackDetailProps`:

```ts
  onEditLocalFile?: (track: TrackRecord, file: TrackDigitalFile) => void
```

Remove this line from the component body:

```ts
  const primaryDigitalFile = primaryTrackDigitalFile(track)
```

- [ ] **Step 2: Replace the old Local files section**

In `TrackDetail`, replace the entire old conditional block:

```tsx
      {hasRealLocalFile(track) ? (
        <section className="detail-section" aria-labelledby="track-files-title">
          <h3 id="track-files-title">Local files</h3>
          ...
        </section>
      ) : null}
```

with:

```tsx
      <DigitalFilesInCollectionSection
        onEditLocalFile={onEditLocalFile}
        track={track}
      />
```

- [ ] **Step 3: Add digital files section components**

Add these components below `RelationCard` and above `DigitalFileMetadata`:

```tsx
type DigitalFilesInCollectionSectionProps = {
  onEditLocalFile?: (track: TrackRecord, file: TrackDigitalFile) => void
  track: TrackRecord
}

function DigitalFilesInCollectionSection({
  onEditLocalFile,
  track,
}: DigitalFilesInCollectionSectionProps) {
  const summary = trackDigitalFileSummary(track)

  return (
    <section className="detail-section" aria-labelledby="track-files-title">
      <h3 id="track-files-title">Digital files in collection</h3>
      <DigitalFilesSummary summary={summary} />
      {track.digitalFiles.length > 0 ? (
        <div className="relation-list track-digital-file-list">
          {track.digitalFiles.map((file) => (
            <DigitalFileMetadata
              file={file}
              files={track.digitalFiles}
              key={file.digitalTrackFileLinkId}
              onEditLocalFile={
                onEditLocalFile
                  ? () => onEditLocalFile(track, file)
                  : undefined
              }
            />
          ))}
        </div>
      ) : (
        <p>No digital files linked to this track through release copies yet.</p>
      )}
    </section>
  )
}

function DigitalFilesSummary({
  summary,
}: {
  summary: ReturnType<typeof trackDigitalFileSummary>
}) {
  return (
    <dl className="track-digital-file-summary" aria-label="Digital file summary">
      <div>
        <dt>Linked rows</dt>
        <dd>{summary.linkedFileRows}</dd>
      </div>
      <div>
        <dt>Unique files</dt>
        <dd>{summary.uniqueLocalFiles}</dd>
      </div>
      <div>
        <dt>Reused files</dt>
        <dd>{summary.reusedLocalFiles}</dd>
      </div>
      <div>
        <dt>Distinct paths</dt>
        <dd>{summary.distinctPaths}</dd>
      </div>
    </dl>
  )
}
```

- [ ] **Step 4: Replace DigitalFileMetadata**

Replace the existing `DigitalFileMetadata` function with:

```tsx
type DigitalFileMetadataProps = {
  file: TrackDigitalFile
  files: readonly TrackDigitalFile[]
  onEditLocalFile?: () => void
}

function DigitalFileMetadata({
  file,
  files,
  onEditLocalFile,
}: DigitalFileMetadataProps) {
  const isReused = isReusedTrackDigitalFile(file, files)
  const hasDifferentPaths = isDifferentTrackDigitalFilePath(file, files)

  return (
    <article className="track-digital-file-card">
      <div className="track-digital-file-card-header">
        <div>
          <span className="badge badge-credit">
            {trackDigitalFilePositionLabel(file)}
          </span>
          <strong>{file.releaseTitle}</strong>
        </div>
        {onEditLocalFile ? (
          <button
            aria-label={`Edit file for ${file.releaseTitle} ${trackDigitalFilePositionLabel(file)}`}
            className="button button-secondary button-compact"
            type="button"
            onClick={onEditLocalFile}
          >
            Edit file
          </button>
        ) : null}
      </div>
      <div className="track-digital-file-path-row">
        <span className="badge badge-tag">{file.format}</span>
        <span className="track-digital-file-path" title={file.path}>
          {file.path}
        </span>
      </div>
      <div className="track-digital-file-state-row">
        {isReused ? (
          <span className="badge badge-tag">Same local file reused</span>
        ) : null}
        {hasDifferentPaths ? (
          <span className="badge badge-tag">Different file path</span>
        ) : null}
      </div>
      <dl className="detail-list">
        <div>
          <dt>Codec</dt>
          <dd>{file.codec}</dd>
        </div>
        <div>
          <dt>Quality</dt>
          <dd>{file.quality}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{file.duration}</dd>
        </div>
        <div>
          <dt>Bitrate</dt>
          <dd>{file.bitrate}</dd>
        </div>
        <div>
          <dt>Sample rate</dt>
          <dd>{file.sampleRate}</dd>
        </div>
        <div>
          <dt>Channels</dt>
          <dd>{file.channels}</dd>
        </div>
        <div>
          <dt>Checksum</dt>
          <dd>{file.contentHash}</dd>
        </div>
      </dl>
    </article>
  )
}
```

- [ ] **Step 5: Add scoped CSS**

Append to `app/src/features/tracks/tracks.css` before the first `@container` block:

```css
.track-digital-file-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin: 0;
}

.track-digital-file-summary > div {
  display: grid;
  gap: 2px;
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: #fbfcfa;
  padding: 8px;
}

.track-digital-file-summary dt {
  color: var(--color-soft);
  font-size: 10px;
  font-weight: 780;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.track-digital-file-summary dd {
  margin: 0;
  color: var(--color-heading);
  font-size: 16px;
  font-weight: 780;
}

.track-digital-file-list {
  gap: 10px;
}

.track-digital-file-card {
  display: grid;
  gap: 8px;
}

.track-digital-file-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.track-digital-file-card-header > div {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.track-digital-file-card-header strong {
  color: var(--color-heading);
  font-size: 13px;
}

.track-digital-file-path-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.track-digital-file-path {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text);
  font-size: 12px;
  font-weight: 620;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-digital-file-state-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
```

- [ ] **Step 6: Run Track workspace tests to verify GREEN**

Run from `app/`:

```bash
npm test -- App.workspaces-tracks-playlists trackDisplayHelpers
```

Expected: PASS.

- [ ] **Step 7: Commit Track detail UI**

Run:

```bash
git add app/src/features/tracks/TrackDetail.tsx app/src/features/tracks/tracks.css app/src/App.workspaces-tracks-playlists.test.tsx
git commit -m "feat: show track digital files as collection context"
```

Expected: commit succeeds with Track detail UI and its tests staged.

### Task 6: Wire Row-Level Edit Actions

**Files:**

- Modify: `app/src/App.local-file-editor.test.tsx`
- Modify: `app/src/features/tracks/TracksWorkspace.tsx`
- Test: `app/src/App.local-file-editor.test.tsx`

- [ ] **Step 1: Update existing browser-mode test**

In `app/src/App.local-file-editor.test.tsx`, replace:

```ts
    expect(
      h.screen.queryByRole('button', { name: 'Edit local file' }),
    ).not.toBeInTheDocument()
```

with:

```ts
    expect(
      h.screen.queryByRole('button', { name: /edit file for/i }),
    ).not.toBeInTheDocument()
```

- [ ] **Step 2: Update existing desktop edit test button click**

In the `validates and applies desktop track local file edits` test, replace:

```ts
    await user.click(h.screen.getByRole('button', { name: 'Edit local file' }))
```

with:

```ts
    await user.click(
      h.screen.getByRole('button', {
        name: /edit file for selected ambient works 85-92 track 3/i,
      }),
    )
```

- [ ] **Step 3: Add selected row edit test**

Add this test after the existing desktop edit test:

```ts
  it('opens the local file editor for the selected track file row', async () => {
    window.history.pushState({}, '', '/tracks?track=polynomial-c')
    const user = h.userEvent.setup()
    const originalDesktopBridge = window.discweaveDesktop
    const baseTrack = h.trackRecords.find((track) => track.id === 'polynomial-c')
    if (!baseTrack) {
      throw new Error('Missing Polynomial-C fixture track')
    }
    h.seedCatalogForTests({
      artists: h.artistRecords,
      releases: h.releaseRecords,
      tracks: h.trackRecords.map((track) =>
        track.id === 'polynomial-c'
          ? {
              ...track,
              digitalFiles: [
                baseTrack.digitalFiles[0],
                {
                  ...baseTrack.digitalFiles[0],
                  digitalTrackFileLinkId: 'link-reissue-file',
                  localAudioFileId: 'local-reissue-file',
                  releaseId: 'selected-ambient-works-reissue',
                  releaseTitle: 'Selected Ambient Works 85-92 Reissue',
                  releaseTrackId: 'release-track-reissue-polynomial-c',
                  position: 'D1',
                  path: '/archive/aphex-twin/reissue/disc-1-polynomial-c.flac',
                },
              ],
            }
          : track,
      ),
      ownedItems: h.ownedItemRecords,
      relations: h.relationRecords,
      playlists: h.playlistRecords,
    })
    const inspect = h.vi.fn().mockResolvedValue({
      path: '/archive/aphex-twin/reissue/disc-1-polynomial-c.flac',
      format: 'flac',
      sizeBytes: 100,
      lastModifiedAt: '2026-05-29T09:15:00.000Z',
      tags: { title: 'Embedded Polynomial-C', artists: ['Aphex Twin'] },
      technical: {
        bitDepth: 16,
        durationSeconds: 284,
        sampleRate: 44100,
      },
    })
    h.vi.stubGlobal(
      'fetch',
      h.vi.fn<Window['fetch']>().mockResolvedValue(
        h.jsonResponse({
          items: [],
          limit: 0,
          offset: 0,
          total: 0,
        }),
      ),
    )
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: h.vi.fn() },
      imports: { pickAndScan: h.vi.fn() },
      localEdits: { inspect, preview: h.vi.fn(), apply: h.vi.fn() },
    }

    h.render(<h.App />)
    await user.click(
      h.screen.getByRole('button', {
        name: /edit file for selected ambient works 85-92 reissue track d1/i,
      }),
    )

    expect(inspect).toHaveBeenCalledWith({
      localAudioFileId: 'local-reissue-file',
      path: '/archive/aphex-twin/reissue/disc-1-polynomial-c.flac',
    })
    const editor = h.screen.getByRole('region', { name: 'Local file editor' })
    expect(
      await h.within(editor).findByText('Embedded Polynomial-C'),
    ).toBeVisible()

    window.discweaveDesktop = originalDesktopBridge
  })
```

- [ ] **Step 4: Run local file editor tests to verify RED**

Run from `app/`:

```bash
npm test -- App.local-file-editor
```

Expected: FAIL because `TracksWorkspace` still passes only the track and `TrackDetail` calls the old edit handler shape.

- [ ] **Step 5: Update TracksWorkspace local edit handler**

In `app/src/features/tracks/TracksWorkspace.tsx`, update imports:

```ts
import {
  isLocalEditsAvailable,
  localEditableFileFromTrackDigitalFile,
  type LocalEditableFile,
} from '../localFiles/localFileEditModel'
```

Update the type import:

```ts
import type { TrackDigitalFile, TrackRecord } from './tracksData'
```

Replace `handleEditLocalFile` with:

```ts
  async function handleEditLocalFile(
    track: TrackRecord,
    file: TrackDigitalFile,
  ) {
    const mappings = await loadTagRoleMappings()
    const editableFile = localEditableFileFromTrackDigitalFile(
      track,
      file,
      mappings.items,
      creditRoleLabelsByCode,
    )
    if (editableFile) {
      setLocalEditFiles([editableFile])
    }
  }
```

Update the `onEditLocalFile` prop passed to `TrackDetail`:

```tsx
          onEditLocalFile={
            canEditLocalFiles
              ? (track, file) => {
                  void handleEditLocalFile(track, file)
                }
              : undefined
          }
```

- [ ] **Step 6: Run local file editor tests to verify GREEN**

Run from `app/`:

```bash
npm test -- App.local-file-editor
```

Expected: PASS.

- [ ] **Step 7: Commit row-level edit wiring**

Run:

```bash
git add app/src/features/tracks/TracksWorkspace.tsx app/src/App.local-file-editor.test.tsx
git commit -m "feat: edit selected track digital file rows"
```

Expected: commit succeeds with row-level edit files staged.

### Task 7: Update Remaining Local File Action Tests

**Files:**

- Modify: `app/src/App.local-file-editor-partial-failure.test.tsx`
- Modify: `app/src/App.local-file-tag-editor.test.tsx`
- Test: local file edit app tests

- [ ] **Step 1: Search for old Track detail edit button assertions**

Run:

```bash
rg -n "Edit local file|Local files" app/src/App.local-file-editor-partial-failure.test.tsx app/src/App.local-file-tag-editor.test.tsx app/src/App.local-file-editor.test.tsx app/src/App.workspaces-tracks-playlists.test.tsx
```

Expected: matches show old button labels in partial failure/tag editor tests and `Local files` only for release batch editor tests if still valid.

- [ ] **Step 2: Replace old track edit button clicks**

In `app/src/App.local-file-editor-partial-failure.test.tsx` and
`app/src/App.local-file-tag-editor.test.tsx`, replace track detail clicks:

```ts
await user.click(h.screen.getByRole('button', { name: 'Edit local file' }))
```

with:

```ts
await user.click(
  h.screen.getByRole('button', {
    name: /edit file for selected ambient works 85-92 track 3/i,
  }),
)
```

Do not replace release detail batch buttons named `Local files`. Those belong
to the release batch local files flow and remain valid in this roadmap item.

- [ ] **Step 3: Run local file edit tests**

Run from `app/`:

```bash
npm test -- App.local-file-editor App.local-file-editor-partial-failure App.local-file-tag-editor
```

Expected: PASS.

- [ ] **Step 4: Commit remaining test updates**

Run:

```bash
git add app/src/App.local-file-editor-partial-failure.test.tsx app/src/App.local-file-tag-editor.test.tsx
git commit -m "test: update track file edit action expectations"
```

Expected: commit succeeds if these files changed. If no files changed because earlier tasks covered all old labels, skip the commit and note that no remaining updates were needed.

### Task 8: Full Frontend Verification

**Files:**

- Modify only files from Tasks 1-7.

- [ ] **Step 1: Run focused Track and local file tests**

Run from `app/`:

```bash
npm test -- App.workspaces-tracks-playlists App.local-file-editor App.local-file-editor-partial-failure App.local-file-tag-editor trackDisplayHelpers localFileEditModel
```

Expected: PASS.

- [ ] **Step 2: Run full frontend tests**

Run from `app/`:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run from `app/`:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run from `app/`:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Run production build**

Run from `app/`:

```bash
npm run build
```

Expected: PASS. A Vite chunk-size warning is acceptable if it matches the existing project warning.

- [ ] **Step 6: Inspect diff and status**

Run:

```bash
git status --short
git diff --stat
```

Expected: only intentional Roadmap 62 frontend files are modified, plus any untracked `.superpowers/` visual companion directory left from brainstorming. Do not stage `.superpowers/`.

- [ ] **Step 7: Commit final verification note if files remain staged**

If verification required no code changes after the last feature/test commits, do not create an empty commit. If a small verification-only fix was needed, stage only that fix and commit:

```bash
git add app/src
git commit -m "chore: verify track digital files UI"
```

Expected: commit succeeds only when there are actual verification-related changes.

## Self-Review

Spec coverage:

- `Local files` heading replacement: Task 4 and Task 5.
- Derived collection context copy: Task 5.
- Summary counts: Task 1, Task 2, Task 4, and Task 5.
- Release-copy row context: Task 4 and Task 5.
- Shared `localAudioFileId` reuse: Task 1, Task 2, Task 4, and Task 5.
- Different paths: Task 1, Task 2, Task 4, and Task 5.
- Row-level selected file editing: Task 3, Task 6, and Task 7.
- Browser mode hidden edit actions: Task 6.
- Search/filter by `track.digitalFiles`: existing behavior remains covered by the existing Track workspace filter test in Task 4/Task 8.
- Accessibility labels for per-row edit actions: Task 5 and Task 6.

No backend, import, Owned Items, Workbench, export, or destructive file flows are included.
