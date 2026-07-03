# Local File Open Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add desktop-only local audio file opening for Tracks, Releases, and Track stacks without any bulk playback action.

**Architecture:** Add a narrow Electron IPC bridge that opens one verified local file per call, then build a React open-file model and shared `LocalFileOpenPanel` around `TrackRecord.digitalFiles`. Tracks can open a single file directly or show the panel for multiple files; releases and stacks always show per-file open actions with no `Open all`.

**Tech Stack:** Electron 42, React 19, TypeScript 6, Vitest, Testing Library, Superdesign CLI.

---

## File Structure

- Create `app/electron/local-file-open.cjs`
  - Single responsibility: validate one renderer-provided local open request against trusted catalog and desktop scan/edit state, then delegate it to Electron `shell.openPath`.
- Create `app/electron/local-file-open.test.cjs`
  - Node/Vitest coverage for invalid paths, missing files, directories, system errors, and successful delegation.
- Modify `app/electron/main.cjs`
  - Register `discweave:local-files:open` using the new handler.
- Modify `app/electron/preload.cjs`
  - Expose `discweaveDesktop.localFiles.open({ digitalTrackFileLinkId, localAudioFileId, path })`.
- Modify `app/electron/preload-contract.test.cjs`
  - Lock the preload contract for `localFiles.open`.
- Modify `app/src/desktop.d.ts`
  - Add renderer types for `localFiles.open`.
- Create `app/src/features/localFiles/localFileOpenModel.ts`
  - Derive de-duplicated openable files from tracks, release tracks, and stack tracks.
- Create `app/src/features/localFiles/localFileOpenModel.test.ts`
  - Unit-test derivation, de-duplication, release filtering, stack ordering, and desktop availability.
- Create `app/src/features/localFiles/LocalFileOpenPanel.tsx`
  - Shared UI for per-file opening and per-row status.
- Create `app/src/features/localFiles/LocalFileOpenPanel.test.tsx`
  - Component tests for open success/failure and absence of bulk open.
- Modify `app/src/features/localFiles/local-files.css`
  - Styles for the open panel, reusing local file editor visual language.
- Modify `app/src/features/tracks/TracksWorkspace.tsx`
  - Own local-open panel state and route track/stack open requests.
- Modify `app/src/features/tracks/TrackDetail.tsx`
  - Pass local open action into the header.
- Modify `app/src/features/tracks/TrackDetailSections.tsx`
  - Render `Open local file` / `Open local files` in track detail actions.
- Modify `app/src/features/tracks/TrackStacksPanel.tsx`
  - Add double-click track open handling and stack-row `Open files` action.
- Modify `app/src/features/tracks/track-stacks.css`
  - Make room for the stack row open action.
- Modify `app/src/features/releases/ReleasesWorkspace.tsx`
  - Own release local-open panel state and route release open requests.
- Modify `app/src/features/releases/ReleaseDetail.tsx`
  - Add `Open local files` action and rename existing edit action to `Edit local files`.
- Create `app/src/App.local-file-open.test.tsx`
  - App-level behavior coverage for track, release, and stack flows.

## Task 1: Superdesign UI Grounding

**Files:**
- Read: `.superdesign/design-system.md`
- Read: `app/src/index.css`
- Read: `app/src/App.css`
- Read: `app/src/app/AppShell.tsx`
- Read: `app/src/features/tracks/TracksWorkspace.tsx`
- Read: `app/src/features/tracks/TrackDetail.tsx`
- Read: `app/src/features/tracks/TrackDetailSections.tsx`
- Read: `app/src/features/tracks/TrackStacksPanel.tsx`
- Read: `app/src/features/releases/ReleasesWorkspace.tsx`
- Read: `app/src/features/releases/ReleaseDetail.tsx`
- Read: `app/src/features/localFiles/local-files.css`
- Read: `app/src/features/tracks/tracks.css`
- Read: `app/src/features/tracks/track-stacks.css`
- Read: `app/src/styles/common-panels.css`

- [ ] **Step 1: Confirm Superdesign CLI is available**

Run:

```bash
superdesign --version
superdesign --help
```

Expected: both commands exit `0`; help output must not show an auth/login error.

- [ ] **Step 2: Create a Superdesign project**

Run:

```bash
PROJECT_JSON="$(superdesign create-project --title "DiscWeave Local File Open" --json)"
PROJECT_ID="$(node -e "const data = JSON.parse(process.argv[1]); console.log(data.id ?? data.project?.id)" "$PROJECT_JSON")"
printf 'Superdesign project: %s\n' "$PROJECT_ID"
test -n "$PROJECT_ID"
```

Expected: prints a non-empty project id.

- [ ] **Step 3: Create the faithful current-UI reproduction draft**

Run:

```bash
DRAFT_JSON="$(superdesign create-design-draft \
  --project-id "$PROJECT_ID" \
  --title "Current Tracks And Releases Local Files UI" \
  -p "Create a pixel-perfect reproduction of the current DiscWeave Tracks and Releases desktop UI around local files. Reproduce the existing master-detail shell, track stack list, track detail digital files section, release detail actions, and local file editor styling exactly from the provided source. Do not add the new feature in this draft." \
  --context-file .superdesign/design-system.md \
  --context-file app/src/index.css \
  --context-file app/src/App.css \
  --context-file app/src/app/AppShell.tsx \
  --context-file app/src/styles/common-panels.css \
  --context-file app/src/features/localFiles/local-files.css \
  --context-file app/src/features/tracks/tracks.css \
  --context-file app/src/features/tracks/track-stacks.css \
  --context-file app/src/features/tracks/TracksWorkspace.tsx \
  --context-file app/src/features/tracks/TrackDetail.tsx \
  --context-file app/src/features/tracks/TrackDetailSections.tsx \
  --context-file app/src/features/tracks/TrackStacksPanel.tsx \
  --context-file app/src/features/releases/ReleasesWorkspace.tsx \
  --context-file app/src/features/releases/ReleaseDetail.tsx \
  --json)"
DRAFT_ID="$(node -e "const data = JSON.parse(process.argv[1]); console.log(data.id ?? data.draft?.id)" "$DRAFT_JSON")"
printf 'Superdesign draft: %s\n' "$DRAFT_ID"
test -n "$DRAFT_ID"
```

Expected: prints a non-empty draft id.

- [ ] **Step 4: Create one design iteration for the local file open panel**

Run:

```bash
superdesign iterate-design-draft \
  --draft-id "$DRAFT_ID" \
  --mode branch \
  -p "Add the approved local file open UI: a compact per-file open panel, a track detail Open local file(s) action, a release detail Open local files action, and a stack row Open files action. Keep the existing dense DiscWeave desktop layout, Inter font, current colors, current radius values, current button styles, and current panel/card density. Do not add playback controls, Open all, gradients, marketing cards, or new navigation. Use ONLY the fonts, colors, spacing, and component styles defined in the design system. Do not introduce any fonts, colors, or visual styles not in the design system." \
  --context-file .superdesign/design-system.md \
  --context-file app/src/index.css \
  --context-file app/src/App.css \
  --context-file app/src/app/AppShell.tsx \
  --context-file app/src/styles/common-panels.css \
  --context-file app/src/features/localFiles/local-files.css \
  --context-file app/src/features/tracks/tracks.css \
  --context-file app/src/features/tracks/track-stacks.css \
  --context-file app/src/features/tracks/TracksWorkspace.tsx \
  --context-file app/src/features/tracks/TrackDetail.tsx \
  --context-file app/src/features/tracks/TrackDetailSections.tsx \
  --context-file app/src/features/tracks/TrackStacksPanel.tsx \
  --context-file app/src/features/releases/ReleasesWorkspace.tsx \
  --context-file app/src/features/releases/ReleaseDetail.tsx \
  --json
```

Expected: command exits `0` and returns a branch draft URL/id. Use it as visual guidance while implementing Tasks 5-8.

## Task 2: Electron Local File Open Handler

**Files:**
- Create: `app/electron/local-file-open.test.cjs`
- Create: `app/electron/local-file-open.cjs`

- [ ] **Step 1: Write the failing handler tests**

Create `app/electron/local-file-open.test.cjs`:

```javascript
// @vitest-environment node

const { createLocalFileOpenHandler } = require('./local-file-open.cjs')

function handlerWith({ stat, openPath }) {
  return createLocalFileOpenHandler({
    fs: { stat },
    shell: { openPath },
  })
}

describe('local file open handler', () => {
  it('rejects empty, relative, and URL paths', async () => {
    const stat = vi.fn()
    const openPath = vi.fn()
    const handler = handlerWith({ stat, openPath })

    await expect(handler(null, '')).resolves.toEqual({
      ok: false,
      reason: 'invalid-path',
      message: 'A valid absolute local file path is required.',
    })
    await expect(handler(null, 'relative/song.flac')).resolves.toEqual({
      ok: false,
      reason: 'invalid-path',
      message: 'A valid absolute local file path is required.',
    })
    await expect(handler(null, 'file:///tmp/song.flac')).resolves.toEqual({
      ok: false,
      reason: 'invalid-path',
      message: 'A valid absolute local file path is required.',
    })

    expect(stat).not.toHaveBeenCalled()
    expect(openPath).not.toHaveBeenCalled()
  })

  it('reports missing files', async () => {
    const stat = vi.fn().mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }))
    const openPath = vi.fn()
    const handler = handlerWith({ stat, openPath })

    await expect(handler(null, '/music/missing.flac')).resolves.toEqual({
      ok: false,
      path: '/music/missing.flac',
      reason: 'missing',
      message: 'The local file does not exist.',
    })
    expect(openPath).not.toHaveBeenCalled()
  })

  it('rejects directories', async () => {
    const stat = vi.fn().mockResolvedValue({ isFile: () => false })
    const openPath = vi.fn()
    const handler = handlerWith({ stat, openPath })

    await expect(handler(null, '/music/folder')).resolves.toEqual({
      ok: false,
      path: '/music/folder',
      reason: 'not-file',
      message: 'The local path is not a file.',
    })
    expect(openPath).not.toHaveBeenCalled()
  })

  it('reports shell failures', async () => {
    const stat = vi.fn().mockResolvedValue({ isFile: () => true })
    const openPath = vi.fn().mockResolvedValue('No application is associated with this file.')
    const handler = handlerWith({ stat, openPath })

    await expect(handler(null, '/music/song.flac')).resolves.toEqual({
      ok: false,
      path: '/music/song.flac',
      reason: 'system-error',
      message: 'No application is associated with this file.',
    })
  })

  it('opens one verified file path', async () => {
    const stat = vi.fn().mockResolvedValue({ isFile: () => true })
    const openPath = vi.fn().mockResolvedValue('')
    const handler = handlerWith({ stat, openPath })

    await expect(handler(null, '/music/song.flac')).resolves.toEqual({
      ok: true,
      path: '/music/song.flac',
    })
    expect(stat).toHaveBeenCalledWith('/music/song.flac')
    expect(openPath).toHaveBeenCalledWith('/music/song.flac')
  })
})
```

- [ ] **Step 2: Run the failing handler tests**

Run:

```bash
cd app && npm test -- electron/local-file-open.test.cjs
```

Expected: FAIL because `./local-file-open.cjs` does not exist.

- [ ] **Step 3: Implement the handler module**

Create `app/electron/local-file-open.cjs`:

```javascript
const path = require('node:path')

function createLocalFileOpenHandler({ fs, shell }) {
  return async function handleLocalFileOpen(_event, filePath) {
    const normalizedPath = normalizedAbsoluteLocalPath(filePath)
    if (!normalizedPath) {
      return {
        ok: false,
        reason: 'invalid-path',
        message: 'A valid absolute local file path is required.',
      }
    }

    let stat
    try {
      stat = await fs.stat(normalizedPath)
    } catch {
      return {
        ok: false,
        path: normalizedPath,
        reason: 'missing',
        message: 'The local file does not exist.',
      }
    }

    if (!stat.isFile()) {
      return {
        ok: false,
        path: normalizedPath,
        reason: 'not-file',
        message: 'The local path is not a file.',
      }
    }

    try {
      const errorMessage = await shell.openPath(normalizedPath)
      if (errorMessage) {
        return {
          ok: false,
          path: normalizedPath,
          reason: 'system-error',
          message: errorMessage,
        }
      }
    } catch (error) {
      return {
        ok: false,
        path: normalizedPath,
        reason: 'system-error',
        message:
          error instanceof Error ? error.message : 'The system could not open this file.',
      }
    }

    return { ok: true, path: normalizedPath }
  }
}

function normalizedAbsoluteLocalPath(filePath) {
  if (typeof filePath !== 'string') {
    return null
  }

  const trimmed = filePath.trim()
  if (!trimmed || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return null
  }

  return path.isAbsolute(trimmed) ? path.normalize(trimmed) : null
}

module.exports = {
  createLocalFileOpenHandler,
  normalizedAbsoluteLocalPath,
}
```

- [ ] **Step 4: Run the handler tests**

Run:

```bash
cd app && npm test -- electron/local-file-open.test.cjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add app/electron/local-file-open.cjs app/electron/local-file-open.test.cjs
git commit -m "Add desktop local file open handler"
```

## Task 3: Desktop Bridge Contract

**Files:**
- Modify: `app/electron/main.cjs`
- Modify: `app/electron/preload.cjs`
- Modify: `app/electron/preload-contract.test.cjs`
- Modify: `app/src/desktop.d.ts`

- [ ] **Step 1: Update the failing preload contract test**

In `app/electron/preload-contract.test.cjs`, update the existing test so the mock has one more resolved value:

```javascript
      .mockResolvedValueOnce({ applied: true, files: [] })
      .mockResolvedValueOnce({ ok: true, path: '/music/track.flac' })
```

Update the exposed bridge keys:

```javascript
    expect(Object.keys(bridge).sort()).toEqual([
      'backend',
      'exports',
      'imports',
      'isDesktop',
      'localEdits',
      'localFiles',
    ])
```

Add this assertion after the `localEdits` key assertion:

```javascript
    expect(Object.keys(bridge.localFiles)).toEqual(['open'])
```

Add this bridge call after the local edit assertions:

```javascript
    await expect(
      bridge.localFiles.open({
        digitalTrackFileLinkId: 'owned-track-link',
        localAudioFileId: 'owned-track',
        path: '/music/track.flac',
      }),
    ).resolves.toEqual({
      ok: true,
      path: '/music/track.flac',
    })
```

Add this IPC assertion after the existing seventh call assertion:

```javascript
    expect(invoke).toHaveBeenNthCalledWith(
      8,
      'discweave:local-files:open',
      {
        digitalTrackFileLinkId: 'owned-track-link',
        localAudioFileId: 'owned-track',
        path: '/music/track.flac',
      },
    )
```

- [ ] **Step 2: Run the failing preload contract test**

Run:

```bash
cd app && npm test -- electron/preload-contract.test.cjs
```

Expected: FAIL because `localFiles` is not exposed.

- [ ] **Step 3: Wire the main process handler**

In `app/electron/main.cjs`, add this import after the local edit imports:

```javascript
const { createLocalFileOpenHandler } = require('./local-file-open.cjs')
```

Add this handler after the existing local edit handlers:

```javascript
ipcMain.handle(
  'discweave:local-files:open',
  createLocalFileOpenHandler({ fs: fsp, shell }),
)
```

- [ ] **Step 4: Expose the preload bridge**

In `app/electron/preload.cjs`, add `localFiles` after `localEdits`:

```javascript
  localFiles: {
    open: (request) => ipcRenderer.invoke('discweave:local-files:open', request),
  },
```

- [ ] **Step 5: Type the renderer bridge**

In `app/src/desktop.d.ts`, add these types after `LocalEditApplyResult`:

```typescript
type LocalFileOpenFailureReason =
  | 'invalid-path'
  | 'missing'
  | 'not-file'
  | 'system-error'

type LocalFileOpenResult =
  | { ok: true; path: string }
  | {
      ok: false
      path?: string
      reason: LocalFileOpenFailureReason
      message: string
    }

type LocalFileOpenRequest = {
  digitalTrackFileLinkId: string
  localAudioFileId: string
  path: string
}
```

Add this property after `localEdits` in `Window['discweaveDesktop']`:

```typescript
      localFiles?: {
        open: (request: LocalFileOpenRequest) => Promise<LocalFileOpenResult>
      }
```

- [ ] **Step 6: Run bridge tests and typecheck**

Run:

```bash
cd app && npm test -- electron/preload-contract.test.cjs electron/local-file-open.test.cjs
cd app && npm run typecheck
```

Expected: both commands PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add app/electron/main.cjs app/electron/preload.cjs app/electron/preload-contract.test.cjs app/src/desktop.d.ts
git commit -m "Expose desktop local file open bridge"
```

## Task 4: React Openable File Model

**Files:**
- Create: `app/src/features/localFiles/localFileOpenModel.test.ts`
- Create: `app/src/features/localFiles/localFileOpenModel.ts`

- [ ] **Step 1: Write the failing model tests**

Create `app/src/features/localFiles/localFileOpenModel.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest'
import type { TrackDigitalFile, TrackRecord } from '../tracks/tracksData'
import {
  isLocalFileOpenAvailable,
  openableFilesFromReleaseTracks,
  openableFilesFromStackTracks,
  openableFilesFromTrack,
} from './localFileOpenModel'

describe('localFileOpenModel', () => {
  it('derives openable files from a track and skips incomplete file links', () => {
    const track = trackWithFiles([
      digitalFile('link-a', 'local-a', '/music/a.flac', 'Selected Release', 'A1'),
      digitalFile('link-empty-path', 'local-empty-path', '   ', 'Selected Release', 'A2'),
      digitalFile('link-empty-id', '   ', '/music/no-id.flac', 'Selected Release', 'A3'),
    ])

    expect(openableFilesFromTrack(track)).toEqual([
      expect.objectContaining({
        id: 'link-a',
        localAudioFileId: 'local-a',
        path: '/music/a.flac',
        trackId: 'track-a',
        trackTitle: 'Track A',
        releaseTitle: 'Selected Release',
        position: 'Track A1',
        format: 'FLAC',
      }),
    ])
  })

  it('de-duplicates by local audio file id before path', () => {
    const track = trackWithFiles([
      digitalFile('link-a', 'local-a', '/music/a.flac', 'Selected Release', 'A1'),
      digitalFile('link-b', 'local-a', '/music/copy.flac', 'Other Release', 'B1'),
      digitalFile('link-c', 'local-c', '/music/a.flac', 'Path Duplicate Release', 'C1'),
    ])

    expect(openableFilesFromTrack(track).map((file) => file.id)).toEqual([
      'link-a',
      'link-c',
    ])
  })

  it('filters release files by release id', () => {
    const selectedTrack = trackWithFiles([
      digitalFile('link-selected', 'local-selected', '/music/selected.flac', 'Selected Release', '3', 'selected-release'),
      digitalFile('link-other', 'local-other', '/music/other.flac', 'Other Release', '7', 'other-release'),
    ])

    expect(
      openableFilesFromReleaseTracks([selectedTrack], 'selected-release').map(
        (file) => file.path,
      ),
    ).toEqual(['/music/selected.flac'])
  })

  it('keeps stack order from original track to members', () => {
    const original = {
      ...trackWithFiles([
        digitalFile('link-original', 'local-original', '/music/original.flac', 'Original Release', '1'),
      ]),
      id: 'original-track',
      title: 'Original Track',
    }
    const member = {
      ...trackWithFiles([
        digitalFile('link-member', 'local-member', '/music/member.flac', 'Member Release', '2'),
      ]),
      id: 'member-track',
      title: 'Member Track',
    }

    expect(openableFilesFromStackTracks([original, member]).map((file) => file.trackTitle)).toEqual([
      'Original Track',
      'Member Track',
    ])
  })

  it('detects desktop local file open availability', () => {
    const originalDesktopBridge = window.discweaveDesktop
    window.discweaveDesktop = undefined
    expect(isLocalFileOpenAvailable()).toBe(false)

    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: vi.fn() },
      imports: { pickAndScan: vi.fn() },
      localFiles: { open: vi.fn() },
    }
    expect(isLocalFileOpenAvailable()).toBe(true)

    window.discweaveDesktop = originalDesktopBridge
  })
})

function trackWithFiles(digitalFiles: TrackDigitalFile[]): TrackRecord {
  return {
    id: 'track-a',
    title: 'Track A',
    artist: 'Archive Artist',
    release: {
      id: 'selected-release',
      title: 'Selected Release',
      artist: 'Archive Artist',
      year: '1992',
      label: 'Archive Label',
    },
    trackNumber: '1',
    duration: '4:00',
    relationHint: '',
    tags: [],
    credits: [],
    releaseAppearances: [],
    relations: [],
    digitalFiles,
  }
}

function digitalFile(
  digitalTrackFileLinkId: string,
  localAudioFileId: string,
  path: string,
  releaseTitle: string,
  position: string,
  releaseId = 'selected-release',
): TrackDigitalFile {
  return {
    digitalTrackFileLinkId,
    localAudioFileId,
    digitalOwnedItemId: `${digitalTrackFileLinkId}-owned`,
    releaseId,
    releaseTitle,
    releaseTrackId: `${digitalTrackFileLinkId}-release-track`,
    position,
    path,
    format: 'FLAC',
    codec: 'FLAC',
    quality: 'Lossless',
    contentHash: `sha256:${digitalTrackFileLinkId}`,
    duration: '4:00',
    bitrate: 'Lossless',
    sampleRate: '44.1 kHz / 16-bit',
    channels: 'Stereo',
  }
}
```

- [ ] **Step 2: Run the failing model tests**

Run:

```bash
cd app && npm test -- src/features/localFiles/localFileOpenModel.test.ts
```

Expected: FAIL because `localFileOpenModel.ts` does not exist.

- [ ] **Step 3: Implement the openable file model**

Create `app/src/features/localFiles/localFileOpenModel.ts`:

```typescript
import { trackDigitalFilePositionLabel } from '../tracks/trackDisplayHelpers'
import type { TrackDigitalFile, TrackRecord } from '../tracks/tracksData'

export type LocalFileOpenFailureReason =
  | 'invalid-path'
  | 'missing'
  | 'not-file'
  | 'system-error'
  | 'unavailable'

export type LocalFileOpenResult =
  | { ok: true; path: string }
  | {
      ok: false
      path?: string
      reason: LocalFileOpenFailureReason
      message: string
    }

export type LocalOpenableFile = {
  id: string
  dedupeKey: string
  trackId: string
  trackTitle: string
  localAudioFileId: string
  digitalTrackFileLinkId: string
  path: string
  format: string
  releaseTitle: string
  position: string
}

export function isLocalFileOpenAvailable() {
  return Boolean(
    window.discweaveDesktop?.isDesktop && window.discweaveDesktop.localFiles,
  )
}

export async function openLocalFile(
  file: Pick<LocalOpenableFile, 'path'>,
): Promise<LocalFileOpenResult> {
  const open = window.discweaveDesktop?.localFiles?.open
  if (!open) {
    return {
      ok: false,
      path: file.path,
      reason: 'unavailable',
      message: 'Local file open is available only in the desktop app.',
    }
  }

  return await open(file.path)
}

export function openableFilesFromTrack(track: TrackRecord) {
  return uniqueOpenableFiles(
    track.digitalFiles
      .map((file) => openableFileFromTrackDigitalFile(track, file))
      .filter((file): file is LocalOpenableFile => Boolean(file)),
  )
}

export function openableFilesFromReleaseTracks(
  tracks: readonly TrackRecord[],
  releaseId: string,
) {
  return uniqueOpenableFiles(
    tracks.flatMap((track) =>
      track.digitalFiles
        .filter((file) => file.releaseId === releaseId)
        .map((file) => openableFileFromTrackDigitalFile(track, file))
        .filter((file): file is LocalOpenableFile => Boolean(file)),
    ),
  )
}

export function openableFilesFromStackTracks(tracks: readonly TrackRecord[]) {
  return uniqueOpenableFiles(tracks.flatMap(openableFilesFromTrack))
}

function openableFileFromTrackDigitalFile(
  track: TrackRecord,
  digitalFile: TrackDigitalFile,
): LocalOpenableFile | null {
  const localAudioFileId = digitalFile.localAudioFileId.trim()
  const filePath = digitalFile.path.trim()
  if (!localAudioFileId || !filePath) {
    return null
  }

  return {
    id: digitalFile.digitalTrackFileLinkId || localAudioFileId,
    dedupeKey: `local:${localAudioFileId.toLowerCase()}`,
    trackId: track.id,
    trackTitle: track.title,
    localAudioFileId,
    digitalTrackFileLinkId: digitalFile.digitalTrackFileLinkId,
    path: filePath,
    format: digitalFile.format.trim() || 'Unknown format',
    releaseTitle: digitalFile.releaseTitle || track.release.title,
    position: trackDigitalFilePositionLabel(digitalFile),
  }
}

function uniqueOpenableFiles(files: LocalOpenableFile[]) {
  const seen = new Set<string>()
  const uniqueFiles: LocalOpenableFile[] = []

  for (const file of files) {
    const dedupeKey = file.dedupeKey || `path:${file.path.trim().toLowerCase()}`
    if (seen.has(dedupeKey)) {
      continue
    }

    seen.add(dedupeKey)
    uniqueFiles.push(file)
  }

  return uniqueFiles
}
```

- [ ] **Step 4: Run the model tests**

Run:

```bash
cd app && npm test -- src/features/localFiles/localFileOpenModel.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add app/src/features/localFiles/localFileOpenModel.ts app/src/features/localFiles/localFileOpenModel.test.ts
git commit -m "Add local file open model"
```

## Task 5: Shared Local File Open Panel

**Files:**
- Create: `app/src/features/localFiles/LocalFileOpenPanel.test.tsx`
- Create: `app/src/features/localFiles/LocalFileOpenPanel.tsx`
- Modify: `app/src/features/localFiles/local-files.css`

- [ ] **Step 1: Write the failing panel tests**

Create `app/src/features/localFiles/LocalFileOpenPanel.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { LocalOpenableFile } from './localFileOpenModel'
import { LocalFileOpenPanel } from './LocalFileOpenPanel'

describe('LocalFileOpenPanel', () => {
  it('opens individual files and never renders an Open all action', async () => {
    const user = userEvent.setup()
    const originalDesktopBridge = window.discweaveDesktop
    const open = vi.fn().mockResolvedValue({ ok: true, path: '/music/a.flac' })
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: vi.fn() },
      imports: { pickAndScan: vi.fn() },
      localFiles: { open },
    }

    render(
      <LocalFileOpenPanel
        files={[openableFile('file-a', '/music/a.flac')]}
        title="Release local files"
        onClose={vi.fn()}
      />,
    )

    const panel = screen.getByRole('region', { name: 'Release local files' })
    expect(within(panel).queryByRole('button', { name: /open all/i })).not.toBeInTheDocument()

    await user.click(
      within(panel).getByRole('button', {
        name: 'Open local file Track A Selected Release Track 1',
      }),
    )

    expect(open).toHaveBeenCalledWith('/music/a.flac')
    expect(await within(panel).findByText('Opened')).toBeVisible()
    window.discweaveDesktop = originalDesktopBridge
  })

  it('shows a row-level failure without hiding other rows', async () => {
    const user = userEvent.setup()
    const originalDesktopBridge = window.discweaveDesktop
    const open = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        path: '/music/missing.flac',
        reason: 'missing',
        message: 'The local file does not exist.',
      })
      .mockResolvedValueOnce({ ok: true, path: '/music/present.flac' })
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: vi.fn() },
      imports: { pickAndScan: vi.fn() },
      localFiles: { open },
    }

    render(
      <LocalFileOpenPanel
        files={[
          openableFile('missing', '/music/missing.flac', 'Missing Track', 'Track 1'),
          openableFile('present', '/music/present.flac', 'Present Track', 'Track 2'),
        ]}
        title="Stack local files"
        onClose={vi.fn()}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Open local file Missing Track Selected Release Track 1',
      }),
    )
    expect(await screen.findByText('The local file does not exist.')).toBeVisible()

    await user.click(
      screen.getByRole('button', {
        name: 'Open local file Present Track Selected Release Track 2',
      }),
    )
    expect(await screen.findByText('Opened')).toBeVisible()
    window.discweaveDesktop = originalDesktopBridge
  })
})

function openableFile(
  id: string,
  path: string,
  trackTitle = 'Track A',
  position = 'Track 1',
): LocalOpenableFile {
  return {
    id,
    dedupeKey: `local:${id}`,
    trackId: 'track-a',
    trackTitle,
    localAudioFileId: id,
    digitalTrackFileLinkId: `${id}-link`,
    path,
    format: 'FLAC',
    releaseTitle: 'Selected Release',
    position,
  }
}
```

- [ ] **Step 2: Run the failing panel tests**

Run:

```bash
cd app && npm test -- src/features/localFiles/LocalFileOpenPanel.test.tsx
```

Expected: FAIL because `LocalFileOpenPanel.tsx` does not exist.

- [ ] **Step 3: Implement the panel**

Create `app/src/features/localFiles/LocalFileOpenPanel.tsx`:

```tsx
import { ExternalLink, X } from 'lucide-react'
import { useState } from 'react'
import {
  openLocalFile,
  type LocalFileOpenResult,
  type LocalOpenableFile,
} from './localFileOpenModel'
import './local-files.css'

type LocalFileOpenPanelProps = Readonly<{
  files: LocalOpenableFile[]
  initialResults?: Record<string, LocalFileOpenResult>
  title: string
  onClose: () => void
}>

export function LocalFileOpenPanel({
  files,
  initialResults = {},
  title,
  onClose,
}: LocalFileOpenPanelProps) {
  const [results, setResults] =
    useState<Record<string, LocalFileOpenResult>>(initialResults)
  const [pendingFileId, setPendingFileId] = useState('')

  async function handleOpen(file: LocalOpenableFile) {
    setPendingFileId(file.id)
    const result = await openLocalFile(file)
    setResults((current) => ({ ...current, [file.id]: result }))
    setPendingFileId('')
  }

  return (
    <section className="panel local-file-open-panel" aria-label={title}>
      <div className="panel-heading local-file-open-heading">
        <div>
          <h2>{title}</h2>
          <p>{files.length} {files.length === 1 ? 'file' : 'files'} available</p>
        </div>
        <button
          aria-label="Close local file list"
          className="icon-button"
          type="button"
          onClick={onClose}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="local-file-open-list">
        {files.map((file) => {
          const result = results[file.id]
          const isPending = pendingFileId === file.id

          return (
            <article className="local-file-open-row" key={file.id}>
              <div className="local-file-open-copy">
                <div className="local-file-open-title-row">
                  <strong>{file.trackTitle}</strong>
                  <span className="badge badge-tag">{file.format}</span>
                </div>
                <p>{file.releaseTitle} · {file.position}</p>
                <p className="local-file-open-path" title={file.path}>
                  {file.path}
                </p>
                {result ? <LocalFileOpenResultMessage result={result} /> : null}
              </div>
              <button
                aria-label={`Open local file ${file.trackTitle} ${file.releaseTitle} ${file.position}`}
                className="button button-secondary button-compact local-file-open-button"
                disabled={isPending}
                type="button"
                onClick={() => {
                  void handleOpen(file)
                }}
              >
                <ExternalLink size={14} aria-hidden="true" />
                {isPending ? 'Opening...' : 'Open'}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function LocalFileOpenResultMessage({
  result,
}: {
  readonly result: LocalFileOpenResult
}) {
  if (result.ok) {
    return (
      <p className="local-file-open-status is-success" role="status">
        Opened
      </p>
    )
  }

  return (
    <p className="local-file-open-status is-error" role="alert">
      {result.message}
    </p>
  )
}
```

- [ ] **Step 4: Add panel CSS**

Append to `app/src/features/localFiles/local-files.css`:

```css
.local-file-open-panel {
  display: grid;
  gap: 0;
  overflow: hidden;
}

.local-file-open-heading {
  align-items: start;
}

.local-file-open-heading .icon-button {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-muted);
  cursor: pointer;
}

.local-file-open-heading .icon-button:hover {
  border-color: var(--color-border-strong);
  color: var(--color-heading);
}

.local-file-open-list {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
}

.local-file-open-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: #fbfcfa;
  padding: 10px;
}

.local-file-open-copy {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.local-file-open-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.local-file-open-title-row strong {
  color: var(--color-heading);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.local-file-open-copy p {
  margin: 0;
  color: var(--color-muted);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.local-file-open-path {
  color: var(--color-text);
  font-weight: 620;
}

.local-file-open-button {
  gap: 6px;
  white-space: nowrap;
}

.local-file-open-status {
  font-weight: 700;
}

.local-file-open-status.is-success {
  color: #2f6f43;
}

.local-file-open-status.is-error {
  color: #8d2f2f;
}

@media (max-width: 700px) {
  .local-file-open-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .local-file-open-button {
    justify-self: start;
  }
}
```

- [ ] **Step 5: Run panel tests**

Run:

```bash
cd app && npm test -- src/features/localFiles/LocalFileOpenPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add app/src/features/localFiles/LocalFileOpenPanel.tsx app/src/features/localFiles/LocalFileOpenPanel.test.tsx app/src/features/localFiles/local-files.css
git commit -m "Add local file open panel"
```

## Task 6: Tracks And Stack Integration

**Files:**
- Modify: `app/src/App.local-file-open.test.tsx`
- Modify: `app/src/features/tracks/TracksWorkspace.tsx`
- Modify: `app/src/features/tracks/TrackDetail.tsx`
- Modify: `app/src/features/tracks/TrackDetailSections.tsx`
- Modify: `app/src/features/tracks/TrackStacksPanel.tsx`
- Modify: `app/src/features/tracks/track-stacks.css`

- [ ] **Step 1: Write failing app tests for track and stack open flows**

Create `app/src/App.local-file-open.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'
import {
  listResponse,
  requestUrls,
  trackResponse,
} from './test/trackStacksTestFixtures'

h.setupAppTestHooks()

describe('App local file open', () => {
  it('opens a selected track single local file from the detail action and double-click', async () => {
    window.history.pushState({}, '', '/tracks?track=polynomial-c')
    const user = h.userEvent.setup()
    const originalDesktopBridge = window.discweaveDesktop
    const open = h.vi.fn().mockResolvedValue({
      ok: true,
      path: '/archive/aphex-twin/selected-ambient-works-85-92/03-polynomial-c.flac',
    })
    window.discweaveDesktop = desktopBridge(open)

    h.render(<h.App />)

    await user.click(
      h.screen.getByRole('button', { name: 'Open local file' }),
    )
    expect(open).toHaveBeenCalledWith(
      '/archive/aphex-twin/selected-ambient-works-85-92/03-polynomial-c.flac',
    )

    await user.dblClick(
      h.screen.getByRole('button', { name: /Polynomial-C Aphex Twin/i }),
    )
    expect(open).toHaveBeenCalledTimes(2)

    window.discweaveDesktop = originalDesktopBridge
  })

  it('shows a per-file list for a track with multiple files', async () => {
    window.history.pushState({}, '', '/tracks?track=polynomial-c')
    const user = h.userEvent.setup()
    const originalDesktopBridge = window.discweaveDesktop
    window.discweaveDesktop = desktopBridge(h.vi.fn())
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
                track.digitalFiles[0],
                {
                  ...track.digitalFiles[0],
                  digitalTrackFileLinkId: 'link-polynomial-c-reissue',
                  localAudioFileId: 'local-polynomial-c-reissue',
                  releaseId: 'selected-ambient-works-reissue',
                  releaseTitle: 'Selected Ambient Works 85-92 Reissue',
                  releaseTrackId: 'release-track-polynomial-c-reissue',
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

    h.render(<h.App />)
    await user.click(
      h.screen.getByRole('button', { name: 'Open local files' }),
    )

    const panel = h.screen.getByRole('region', { name: 'Track local files' })
    expect(h.within(panel).getByText('Selected Ambient Works 85-92')).toBeVisible()
    expect(
      h.within(panel).getByText('Selected Ambient Works 85-92 Reissue'),
    ).toBeVisible()
    expect(h.within(panel).queryByRole('button', { name: /open all/i })).not.toBeInTheDocument()
    expect(baseTrack.title).toBe('Polynomial-C')

    window.discweaveDesktop = originalDesktopBridge
  })

  it('opens the full stack file list even when filters hide a member', async () => {
    window.history.pushState({}, '', '/tracks')
    const user = h.userEvent.setup()
    const originalDesktopBridge = window.discweaveDesktop
    window.discweaveDesktop = desktopBridge(h.vi.fn())
    h.clearCatalogForTests()
    const fetchMock = h.vi.fn<Window['fetch']>(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      await Promise.resolve()

      if (url.startsWith('/api/tracks/stacks')) {
        return listResponse([
          {
            originalTrackId: 'track-original',
            originalTitle: 'Original Mix',
            originalVersionYear: 1992,
            memberCount: 1,
            hasCycleIssue: false,
            members: [
              {
                trackId: 'track-member',
                title: 'Hidden Dub',
                versionYear: 1993,
                relationType: 'versionOf',
                depth: 1,
                isDirect: true,
              },
            ],
            issues: [],
          },
        ])
      }

      if (url.startsWith('/api/tracks?')) {
        return listResponse([
          {
            ...trackResponse('track-original', 'Original Mix', true),
            digitalFiles: [
              apiDigitalFile(
                'original',
                'track-original',
                'Original Release',
                1,
                '/music/original.flac',
              ),
            ],
          },
          {
            ...trackResponse('track-member', 'Hidden Dub'),
            digitalFiles: [
              apiDigitalFile(
                'member',
                'track-member',
                'Member Release',
                2,
                '/music/hidden-dub.flac',
              ),
            ],
          },
        ])
      }

      if (url.startsWith('/api/settings/dictionaries?')) {
        return h.defaultDictionaryListResponse()
      }

      if (url.startsWith('/api/rating-criteria?')) {
        return h.defaultRatingCriteriaListResponse()
      }

      return h.emptyCatalogListResponse()
    })
    h.vi.stubGlobal('fetch', fetchMock)

    h.render(<h.App />)
    expect(
      await h.screen.findByRole('heading', { name: 'Track records' }),
    ).toBeInTheDocument()
    await h.waitFor(() => {
      expect(
        requestUrls(fetchMock).some((url) =>
          url.startsWith('/api/tracks/stacks'),
        ),
      ).toBe(true)
    })
    await user.type(
      h.screen.getByPlaceholderText(/Title, artist/i),
      'Original',
    )
    await user.click(
      h.screen.getByRole('button', { name: 'Open stack files for Original Mix' }),
    )

    const panel = h.screen.getByRole('region', { name: 'Stack local files' })
    expect(h.within(panel).getByText('Original Mix')).toBeVisible()
    expect(h.within(panel).getByText('Hidden Dub')).toBeVisible()
    expect(h.within(panel).queryByRole('button', { name: /open all/i })).not.toBeInTheDocument()

    window.discweaveDesktop = originalDesktopBridge
  })
})

function apiDigitalFile(
  id: string,
  trackId: string,
  releaseTitle: string,
  position: number,
  path: string,
) {
  return {
    digitalTrackFileLinkId: `link-${id}`,
    localAudioFileId: `local-${id}`,
    digitalOwnedItemId: `owned-${id}`,
    releaseId: `release-${id}`,
    releaseTitle,
    releaseArtist: 'Fixture Artist',
    releaseYear: 1993,
    releaseDate: null,
    releaseLabel: 'Fixture Label',
    releaseCatalogNumber: null,
    releaseTrackId: `release-track-${trackId}`,
    position,
    disc: null,
    side: null,
    path,
    format: 'flac',
    codec: 'FLAC',
    quality: null,
    sizeBytes: null,
    modifiedAt: null,
    contentHash: null,
    durationSeconds: 240,
    bitrateKbps: null,
    sampleRateHz: null,
    channels: null,
  }
}

function desktopBridge(open: ReturnType<typeof h.vi.fn>): Window['discweaveDesktop'] {
  return {
    isDesktop: true,
    exports: { download: h.vi.fn() },
    imports: { pickAndScan: h.vi.fn() },
    localFiles: { open },
  }
}
```

- [ ] **Step 2: Run the failing app tests**

Run:

```bash
cd app && npm test -- src/App.local-file-open.test.tsx
```

Expected: FAIL because the open actions are not rendered.

- [ ] **Step 3: Add track detail action props**

In `app/src/features/tracks/TrackDetailSections.tsx`, extend `TrackDetailHeaderProps`:

```typescript
  localFileCount?: number
  onOpenLocalFiles?: () => void
```

Add the props to `TrackDetailHeader` parameters:

```typescript
  localFileCount = 0,
  onOpenLocalFiles,
```

Render this button before `Edit record` inside `.detail-actions`:

```tsx
          {onOpenLocalFiles && localFileCount > 0 ? (
            <button
              className="button button-secondary"
              type="button"
              onClick={onOpenLocalFiles}
            >
              {localFileCount === 1 ? 'Open local file' : 'Open local files'}
            </button>
          ) : null}
```

In `app/src/features/tracks/TrackDetail.tsx`, add props:

```typescript
  localFileCount?: number
  onOpenLocalFiles?: () => void
```

Pass them to `TrackDetailHeader`:

```tsx
        localFileCount={localFileCount}
        onOpenLocalFiles={onOpenLocalFiles}
```

- [ ] **Step 4: Add track and stack open callbacks to `TrackStacksPanel`**

In `app/src/features/tracks/TrackStacksPanel.tsx`, import:

```typescript
import { openableFilesFromStackTracks, openableFilesFromTrack } from '../localFiles/localFileOpenModel'
```

Extend `TrackStacksPanelProps`:

```typescript
  onOpenStackLocalFiles?: (stackTitle: string, tracks: TrackRecord[]) => void
  onOpenTrackLocalFiles?: (track: TrackRecord) => void
```

Add props to the component parameter list:

```typescript
  onOpenStackLocalFiles,
  onOpenTrackLocalFiles,
```

Inside `stacks.map`, compute:

```typescript
          const stackTracks = [
            stack.original,
            ...stack.members.map((member) => member.track),
          ]
          const stackOpenableFileCount =
            onOpenStackLocalFiles && openableFilesFromStackTracks(stackTracks).length
          const originalOpenableFileCount =
            onOpenTrackLocalFiles && openableFilesFromTrack(stack.original).length
```

Add double-click to the root title button:

```tsx
                  onDoubleClick={
                    originalOpenableFileCount
                      ? () => onOpenTrackLocalFiles?.(stack.original)
                      : undefined
                  }
```

Render the stack action after `TrackStackFacts`:

```tsx
                {stackOpenableFileCount ? (
                  <button
                    aria-label={`Open stack files for ${stack.original.title}`}
                    className="button button-secondary button-compact track-stack-open-files"
                    type="button"
                    onClick={() => onOpenStackLocalFiles?.(stack.original.title, stackTracks)}
                  >
                    Open files
                  </button>
                ) : null}
```

Pass `onOpenTrackLocalFiles` through `TrackStackMemberGroups`, `TrackStackMemberGroupView`, and `TrackStackMemberButton`. In `TrackStackMemberButton`, compute `memberOpenableFileCount` and add:

```tsx
      onDoubleClick={
        memberOpenableFileCount
          ? () => onOpenTrackLocalFiles?.(member.track)
          : undefined
      }
```

- [ ] **Step 5: Add workspace state and handlers**

In `app/src/features/tracks/TracksWorkspace.tsx`, import:

```typescript
import { LocalFileOpenPanel } from '../localFiles/LocalFileOpenPanel'
import {
  isLocalFileOpenAvailable,
  openableFilesFromStackTracks,
  openableFilesFromTrack,
  openLocalFile,
  type LocalFileOpenResult,
  type LocalOpenableFile,
} from '../localFiles/localFileOpenModel'
```

Add state near `localEditFiles`:

```typescript
  const [localOpenPanel, setLocalOpenPanel] = useState<{
    files: LocalOpenableFile[]
    initialResults?: Record<string, LocalFileOpenResult>
    title: string
  } | null>(null)
```

Add handlers after `handleEditLocalFile`:

```typescript
  async function handleOpenTrackLocalFiles(track: TrackRecord) {
    const files = openableFilesFromTrack(track)
    if (files.length === 0) {
      return
    }

    if (files.length === 1) {
      const result = await openLocalFile(files[0])
      if (!result.ok) {
        setLocalOpenPanel({
          files,
          initialResults: { [files[0].id]: result },
          title: 'Track local files',
        })
      }
      return
    }

    setLocalOpenPanel({ files, title: 'Track local files' })
  }

  function handleOpenStackLocalFiles(_stackTitle: string, stackTracks: TrackRecord[]) {
    const files = openableFilesFromStackTracks(stackTracks)
    if (files.length > 0) {
      setLocalOpenPanel({ files, title: 'Stack local files' })
    }
  }
```

Add availability:

```typescript
  const canOpenLocalFiles = isLocalFileOpenAvailable()
```

Render the panel after `LocalFileEditPanel`:

```tsx
        {localOpenPanel ? (
          <LocalFileOpenPanel
            files={localOpenPanel.files}
            initialResults={localOpenPanel.initialResults}
            title={localOpenPanel.title}
            onClose={() => setLocalOpenPanel(null)}
          />
        ) : null}
```

Pass callbacks to `TrackStacksPanel`:

```tsx
          onOpenStackLocalFiles={
            canOpenLocalFiles ? handleOpenStackLocalFiles : undefined
          }
          onOpenTrackLocalFiles={
            canOpenLocalFiles
              ? (track) => {
                  void handleOpenTrackLocalFiles(track)
                }
              : undefined
          }
```

Pass local open props to `TrackDetail`:

```tsx
          localFileCount={
            canOpenLocalFiles ? openableFilesFromTrack(selectedTrack).length : 0
          }
          onOpenLocalFiles={
            canOpenLocalFiles
              ? () => {
                  void handleOpenTrackLocalFiles(selectedTrack)
                }
              : undefined
          }
```

- [ ] **Step 6: Update stack CSS**

In `app/src/features/tracks/track-stacks.css`, change `.track-stack-root`:

```css
  grid-template-columns: 34px minmax(180px, 1fr) minmax(260px, 0.9fr) auto;
```

Add:

```css
.track-stack-open-files {
  justify-self: end;
  white-space: nowrap;
}
```

In the mobile media query, change `.track-stack-root` to:

```css
    grid-template-columns: 32px minmax(0, 1fr) auto;
```

Add:

```css
  .track-stack-open-files {
    grid-column: 2 / -1;
    justify-self: start;
  }
```

- [ ] **Step 7: Run tracks tests**

Run:

```bash
cd app && npm test -- src/App.local-file-open.test.tsx src/App.track-stacks.test.tsx
cd app && npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add app/src/App.local-file-open.test.tsx app/src/features/tracks/TracksWorkspace.tsx app/src/features/tracks/TrackDetail.tsx app/src/features/tracks/TrackDetailSections.tsx app/src/features/tracks/TrackStacksPanel.tsx app/src/features/tracks/track-stacks.css
git commit -m "Add track and stack local file open actions"
```

## Task 7: Release Integration

**Files:**
- Modify: `app/src/App.local-file-open.test.tsx`
- Modify: `app/src/features/releases/ReleasesWorkspace.tsx`
- Modify: `app/src/features/releases/ReleaseDetail.tsx`

- [ ] **Step 1: Add failing release behavior tests**

Append to `app/src/App.local-file-open.test.tsx` inside the existing `describe`:

```tsx
  it('shows release local files with per-file open actions and no Open all', async () => {
    window.history.pushState(
      {},
      '',
      '/releases?release=selected-ambient-works-85-92',
    )
    const user = h.userEvent.setup()
    const originalDesktopBridge = window.discweaveDesktop
    window.discweaveDesktop = desktopBridge(h.vi.fn())

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Selected Ambient Works 85-92',
    })
    await user.click(
      h.within(detailPanel).getByRole('button', { name: 'Open local files' }),
    )

    const panel = h.screen.getByRole('region', { name: 'Release local files' })
    expect(h.within(panel).getByText('Polynomial-C')).toBeVisible()
    expect(
      h.within(panel).getByText(
        '/archive/aphex-twin/selected-ambient-works-85-92/03-polynomial-c.flac',
      ),
    ).toBeVisible()
    expect(h.within(panel).queryByRole('button', { name: /open all/i })).not.toBeInTheDocument()

    window.discweaveDesktop = originalDesktopBridge
  })
```

- [ ] **Step 2: Run the failing release test**

Run:

```bash
cd app && npm test -- src/App.local-file-open.test.tsx
```

Expected: FAIL because release detail has no `Open local files` action.

- [ ] **Step 3: Add release open state and handler**

In `app/src/features/releases/ReleasesWorkspace.tsx`, import:

```typescript
import { LocalFileOpenPanel } from '../localFiles/LocalFileOpenPanel'
import {
  isLocalFileOpenAvailable,
  openableFilesFromReleaseTracks,
  type LocalOpenableFile,
} from '../localFiles/localFileOpenModel'
```

Add state near `localEditFiles`:

```typescript
  const [localOpenPanel, setLocalOpenPanel] = useState<{
    files: LocalOpenableFile[]
    title: string
  } | null>(null)
```

Add handler after `handleEditLocalFiles`:

```typescript
  function handleOpenReleaseLocalFiles(
    localTracks: TrackRecord[],
    release: ReleaseRecord,
  ) {
    const files = openableFilesFromReleaseTracks(localTracks, release.id)
    if (files.length > 0) {
      setLocalOpenPanel({ files, title: 'Release local files' })
    }
  }
```

Add availability:

```typescript
  const canOpenLocalFiles = isLocalFileOpenAvailable()
```

Render the panel after `LocalFileEditPanel`:

```tsx
        {localOpenPanel ? (
          <LocalFileOpenPanel
            files={localOpenPanel.files}
            title={localOpenPanel.title}
            onClose={() => setLocalOpenPanel(null)}
          />
        ) : null}
```

Pass the prop to `ReleaseDetail`:

```tsx
          onOpenLocalFiles={
            canOpenLocalFiles
              ? (localTracks, release) => {
                  handleOpenReleaseLocalFiles(localTracks, release)
                }
              : undefined
          }
```

- [ ] **Step 4: Add the release detail action**

In `app/src/features/releases/ReleaseDetail.tsx`, extend `ReleaseDetailProps`:

```typescript
  onOpenLocalFiles?: (tracks: TrackRecord[], release: ReleaseRecord) => void
```

Add the prop to the component parameter list:

```typescript
  onOpenLocalFiles,
```

Update the detail action condition:

```tsx
        onDelete ||
        (onEditLocalFiles && localTracks.length > 0) ||
        (onOpenLocalFiles && localTracks.length > 0) ? (
```

Add the open action before the edit action:

```tsx
            {onOpenLocalFiles && localTracks.length > 0 ? (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => onOpenLocalFiles(localTracks, release)}
              >
                Open local files
              </button>
            ) : null}
```

Rename the existing local edit button text from `Local files` to:

```tsx
                Edit local files
```

- [ ] **Step 5: Run release and local editor regression tests**

Run:

```bash
cd app && npm test -- src/App.local-file-open.test.tsx src/App.local-file-editor.release-batch.test.tsx
cd app && npm run typecheck
```

Expected: PASS. If `App.local-file-editor.release-batch.test.tsx` expects `Local files`, update those expectations to `Edit local files` because the edit action label is intentionally clearer after adding open.

- [ ] **Step 6: Commit**

Run:

```bash
git add app/src/App.local-file-open.test.tsx app/src/features/releases/ReleasesWorkspace.tsx app/src/features/releases/ReleaseDetail.tsx app/src/App.local-file-editor.release-batch.test.tsx
git commit -m "Add release local file open action"
```

## Task 8: Verification And Cleanup

**Files:**
- Inspect: all files changed by Tasks 2-7.

- [ ] **Step 1: Run focused tests**

Run:

```bash
cd app && npm test -- \
  electron/local-file-open.test.cjs \
  electron/preload-contract.test.cjs \
  src/features/localFiles/localFileOpenModel.test.ts \
  src/features/localFiles/LocalFileOpenPanel.test.tsx \
  src/App.local-file-open.test.tsx \
  src/App.local-file-editor.test.tsx \
  src/App.local-file-editor.release-batch.test.tsx \
  src/App.track-stacks.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run app typecheck and lint**

Run:

```bash
cd app && npm run typecheck
cd app && npm run lint
```

Expected: PASS.

- [ ] **Step 3: Run the full app test suite if focused checks pass**

Run:

```bash
cd app && npm test
```

Expected: PASS.

- [ ] **Step 4: Inspect git diff for accidental scope growth**

Run:

```bash
git diff --stat HEAD
git diff --name-only HEAD
```

Expected: only files listed in this plan are changed since the last task commit.

- [ ] **Step 5: Commit final cleanup if needed**

If Step 4 shows formatting-only or small cleanup changes, run:

```bash
git add app/electron app/src
git commit -m "Verify local file open flow"
```

Expected: commit succeeds only if there are cleanup changes. If there are no changes, do not create an empty commit.
