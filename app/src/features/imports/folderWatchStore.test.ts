import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WatchedImportFolder } from '../../desktop'
import type {
  ImportFolderBaseline,
  ReleaseImportSession,
} from '../catalog/catalogApi'
import {
  addWatchedFolder,
  applyWatchedCatalogChanges,
  checkWatchedFolder,
  dismissWatchedChanges,
  onWatchedSessionUpdated,
  resetFolderWatchForTests,
} from './folderWatchStore'

const api = vi.hoisted(() => ({
  appendDesktopFolderScan: vi.fn(),
  createDesktopFolderScan: vi.fn(),
  getImportFolderBaseline: vi.fn(),
  loadImportSessions: vi.fn(),
  updateLocalAudioFile: vi.fn(),
}))

vi.mock('../catalog/catalogApi', () => api)

const sessionId = 'session-1'
const root = '/music'
const modifiedAt = '2026-05-16T12:00:00.000Z'

function diskFile(filePath: string, sizeBytes = 10) {
  return { filePath, sizeBytes, lastModifiedAt: modifiedAt }
}

function sessionWithDraft(draftId: string, filePath: string) {
  return {
    id: sessionId,
    drafts: [{ id: draftId, status: 'ready', tracks: [{ filePath }] }],
  } as unknown as ReleaseImportSession
}

function installDesktop(diskFiles: ReturnType<typeof diskFile>[]) {
  let folders: WatchedImportFolder[] = []
  const watch = {
    list: vi.fn(() => Promise.resolve(folders)),
    add: vi.fn((request?: { sourceRoot: string }) => {
      const sourceRoot = request?.sourceRoot ?? root
      if (!folders.some((folder) => folder.sourceRoot === sourceRoot)) {
        folders = [
          ...folders,
          {
            sourceRoot,
            sessionId: null,
            newDraftIds: [],
            dismissed: {},
            lastCheckedAt: null,
          },
        ]
      }
      return Promise.resolve({ cancelled: false as const, sourceRoot, folders })
    }),
    remove: vi.fn((sourceRoot: string) => {
      folders = folders.filter((folder) => folder.sourceRoot !== sourceRoot)
      return Promise.resolve(folders)
    }),
    update: vi.fn((sourceRoot: string, patch: Partial<WatchedImportFolder>) => {
      folders = folders.map((folder) =>
        folder.sourceRoot === sourceRoot ? { ...folder, ...patch } : folder,
      )
      return Promise.resolve(folders)
    }),
    snapshot: vi.fn(() =>
      Promise.resolve({ sourceRoot: root, files: diskFiles }),
    ),
    scanFiles: vi.fn((_root: string, filePaths: string[]) =>
      Promise.resolve({
        sourceRoot: root,
        scanMode: 'full' as const,
        ignoredFileCount: 0,
        diagnostics: [],
        files: filePaths.map((filePath) => ({
          ...diskFile(filePath, 42),
          relativePath: filePath.slice(root.length + 1),
          format: 'flac',
          contentHash: `hash:${filePath}`,
          audioMetadata: null,
          coverArtifact: null,
        })),
      }),
    ),
    onChanged: vi.fn(() => () => {}),
  }
  vi.stubGlobal('discweaveDesktop', { isDesktop: true, imports: { watch } })
  return { watch, folders: () => folders }
}

function catalogBaseline(paths: string[]): ImportFolderBaseline {
  return {
    sourceRoot: root,
    otherKnownPaths: [],
    drafts: [
      {
        draftId: null,
        status: 'confirmed',
        sourcePath: null,
        releaseId: 'release-1',
        title: 'Album A',
        files: paths.map((path, index) => ({
          path,
          sizeBytes: 10,
          lastModifiedAt: modifiedAt,
          localAudioFileId: `file-${index}`,
        })),
      },
    ],
  }
}

const watchedSession = { id: sessionId, sourceRoot: root }

describe('folder watch store', () => {
  beforeEach(() => {
    resetFolderWatchForTests()
    vi.clearAllMocks()
    api.loadImportSessions.mockResolvedValue({ items: [] })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('appends new release folders to the watched import and counts them as new', async () => {
    const desktop = installDesktop([
      diskFile('/music/A/01.flac'),
      diskFile('/music/New/01.flac'),
    ])
    api.getImportFolderBaseline.mockResolvedValue(
      catalogBaseline(['/music/A/01.flac']),
    )
    const appended = sessionWithDraft('new-draft', '/music/New/01.flac')
    api.appendDesktopFolderScan.mockResolvedValue(appended)
    const updated = vi.fn()
    onWatchedSessionUpdated(updated)

    await addWatchedFolder(watchedSession)

    expect(desktop.watch.add).toHaveBeenCalledWith({ sourceRoot: root })
    expect(desktop.watch.scanFiles).toHaveBeenCalledWith(root, [
      '/music/New/01.flac',
    ])
    expect(api.appendDesktopFolderScan).toHaveBeenCalledTimes(1)
    expect(api.appendDesktopFolderScan.mock.calls[0][0]).toBe(sessionId)
    expect(updated).toHaveBeenCalledWith(appended)
    expect(desktop.folders()[0]).toMatchObject({
      sessionId,
      newDraftIds: ['new-draft'],
    })
    expect(desktop.folders()[0].lastCheckedAt).not.toBeNull()
  })

  it('creates an empty import for a picked folder and replaces an archived one', async () => {
    const desktop = installDesktop([diskFile('/music/A/01.flac')])
    api.createDesktopFolderScan
      .mockResolvedValueOnce({ id: 'created-1', sourceRoot: root })
      .mockResolvedValueOnce({ id: 'created-2', sourceRoot: root })
    api.getImportFolderBaseline.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'created-1' && api.createDesktopFolderScan.mock.calls.length > 1
          ? null
          : catalogBaseline(['/music/A/01.flac']),
      ),
    )

    await addWatchedFolder()

    expect(desktop.watch.add).toHaveBeenCalledWith(undefined)
    expect(api.createDesktopFolderScan).toHaveBeenCalledWith(
      expect.objectContaining({ sourceRoot: root, files: [] }),
    )
    expect(desktop.folders()[0].sessionId).toBe('created-1')
    expect(api.appendDesktopFolderScan).not.toHaveBeenCalled()

    // The import was archived: its baseline is gone and no open import remains.
    api.createDesktopFolderScan.mockClear()
    api.getImportFolderBaseline.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'created-1' ? null : catalogBaseline(['/music/A/01.flac']),
      ),
    )
    api.createDesktopFolderScan.mockResolvedValueOnce({
      id: 'created-2',
      sourceRoot: root,
    })
    await checkWatchedFolder(root)

    expect(desktop.folders()[0].sessionId).toBe('created-2')
  })

  it('reuses an open import of the folder instead of creating one', async () => {
    const desktop = installDesktop([])
    api.loadImportSessions.mockResolvedValue({
      items: [
        { id: 'archived', sourceRoot: root, archivedAt: '2026-10-01' },
        { id: 'open', sourceRoot: root, archivedAt: null },
      ],
    })
    api.getImportFolderBaseline.mockResolvedValue(catalogBaseline([]))

    await addWatchedFolder()

    expect(api.createDesktopFolderScan).not.toHaveBeenCalled()
    expect(desktop.folders()[0].sessionId).toBe('open')
  })

  it('applies renamed catalog files only on request and keeps missing files flagged', async () => {
    const desktop = installDesktop([diskFile('/music/A/01 Renamed.flac')])
    const baseline = catalogBaseline(['/music/A/01.flac', '/music/A/02.flac'])
    baseline.drafts[0].files[1].sizeBytes = 77
    api.getImportFolderBaseline.mockResolvedValue(baseline)

    await addWatchedFolder(watchedSession)
    expect(api.updateLocalAudioFile).not.toHaveBeenCalled()
    expect(api.appendDesktopFolderScan).not.toHaveBeenCalled()

    await applyWatchedCatalogChanges(root, 'release-1')

    expect(desktop.watch.scanFiles).toHaveBeenCalledWith(root, [
      '/music/A/01 Renamed.flac',
    ])
    expect(api.updateLocalAudioFile).toHaveBeenCalledTimes(1)
    expect(api.updateLocalAudioFile).toHaveBeenCalledWith('file-0', {
      path: '/music/A/01 Renamed.flac',
      sizeBytes: 42,
      lastModifiedAt: modifiedAt,
      contentHash: 'hash:/music/A/01 Renamed.flac',
    })
    expect(api.appendDesktopFolderScan).not.toHaveBeenCalled()
  })

  it('hides dismissed changes until the folder changes again', async () => {
    const desktop = installDesktop([])
    api.getImportFolderBaseline.mockResolvedValue(
      catalogBaseline(['/music/A/01.flac']),
    )
    await addWatchedFolder(watchedSession)

    await dismissWatchedChanges(root, 'release-1')
    await checkWatchedFolder(root)

    expect(Object.keys(desktop.folders()[0].dismissed)).toEqual(['release-1'])
    await expect(dismissWatchedChanges(root, 'release-1')).rejects.toThrow(
      'Check the folder again',
    )

    api.getImportFolderBaseline.mockResolvedValue(
      catalogBaseline(['/music/A/01.flac', '/music/A/02.flac']),
    )
    await checkWatchedFolder(root)
    await expect(
      dismissWatchedChanges(root, 'release-1'),
    ).resolves.toBeUndefined()
  })
})
