import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReleaseImportDraft } from '../catalog/catalogApi'
import type { StagedLocalEdit } from '../localFiles/localFileEditTypes'
import {
  finishConfirmedImport,
  importEditableFiles,
  loadStagedLocalEdits,
  saveStagedLocalEdits,
} from './importLocalEdits'

const catalogApi = vi.hoisted(() => ({
  loadRelease: vi.fn(),
  updateLocalAudioFile: vi.fn(),
}))

vi.mock('../catalog/catalogApi', () => catalogApi)

const sourcePath = '/music/in/Artist - Album/01 track.flac'
const targetPath = '/music/in/Artist - Album (1997)/01 Song.flac'

const stagedEdit: StagedLocalEdit = {
  currentPath: sourcePath,
  targetPath,
  targetTags: { title: 'Song' },
  tagChanges: { title: 'Song' },
}

const draft = {
  id: 'draft-1',
  sourceKind: 'localFiles',
  sourcePath: '/music/in/Artist - Album',
  relativePath: 'Artist - Album',
  status: 'ready',
  title: 'Album',
  type: 'album',
  year: 1997,
  isVariousArtists: false,
  notOnLabel: false,
  artistNames: ['Artist'],
  selectedArtistIds: [],
  artistSuggestions: [],
  genres: ['House'],
  tags: [],
  issues: [],
  tracks: [
    {
      id: 'track-1',
      sourceKind: 'localFiles',
      filePath: sourcePath,
      position: 1,
      title: 'Song',
      artistNames: [],
      isSkipped: false,
    },
    {
      id: 'track-2',
      sourceKind: 'localFiles',
      filePath: '/music/in/Artist - Album/02 skipped.flac',
      title: 'Skipped',
      artistNames: [],
      isSkipped: true,
    },
  ],
} as unknown as ReleaseImportDraft

describe('import local edits', () => {
  const apply = vi.fn()
  const onCatalogChanged = vi.fn()

  beforeEach(() => {
    window.localStorage.clear()
    window.history.pushState({}, '', '/imports')
    window.discweaveDesktop = {
      isDesktop: true,
      localEdits: { apply, inspect: vi.fn(), preview: vi.fn() },
    } as unknown as Window['discweaveDesktop']
    catalogApi.loadRelease.mockResolvedValue({
      tracklist: [
        {
          linkedLocalFiles: [{ localAudioFileId: 'file-1', path: sourcePath }],
        },
      ],
    })
    catalogApi.updateLocalAudioFile.mockResolvedValue({})
  })

  afterEach(() => {
    vi.clearAllMocks()
    window.discweaveDesktop = undefined
  })

  it('builds editable rows from included tracks and restores a staged plan', () => {
    const files = importEditableFiles(draft, [stagedEdit])

    expect(files).toHaveLength(1)
    expect(files[0]).toMatchObject({
      rowId: 'track-1',
      localAudioFileId: '',
      currentPath: sourcePath,
      targetPath,
      trackArtists: 'Artist',
      targetTags: { title: 'Song' },
      tags: { album: 'Album', albumArtists: ['Artist'], year: 1997 },
    })
  })

  it('applies the staged plan to catalog files and opens the release', async () => {
    saveStagedLocalEdits(draft.id, [stagedEdit])
    apply.mockResolvedValue({
      applied: true,
      operationLogPath: null,
      files: [
        {
          localAudioFileId: 'file-1',
          path: targetPath,
          format: 'flac',
          sizeBytes: 1,
          lastModifiedAt: '2026-10-04T00:00:00.000Z',
          contentHash: 'hash',
        },
      ],
    })

    const outcome = await finishConfirmedImport(
      draft.id,
      'release-1',
      onCatalogChanged,
    )

    expect(outcome).toEqual({ kind: 'applied', releaseId: 'release-1' })
    expect(apply).toHaveBeenCalledWith({
      files: [
        {
          localAudioFileId: 'file-1',
          currentPath: sourcePath,
          targetPath,
          tags: { title: 'Song' },
        },
      ],
    })
    expect(catalogApi.updateLocalAudioFile).toHaveBeenCalledWith(
      'file-1',
      expect.objectContaining({ path: targetPath }),
    )
    expect(
      catalogApi.updateLocalAudioFile.mock.invocationCallOrder[0],
    ).toBeLessThan(onCatalogChanged.mock.invocationCallOrder[0])
    expect(loadStagedLocalEdits(draft.id)).toEqual([])
    expect(window.location.pathname + window.location.search).toBe(
      '/releases?release=release-1',
    )
  })

  it('keeps the plan and stays on imports when applying stops partway', async () => {
    saveStagedLocalEdits(draft.id, [stagedEdit])
    apply.mockResolvedValue({
      applied: false,
      operationLogPath: '/logs/op.json',
      changes: [],
      files: [],
    })

    const outcome = await finishConfirmedImport(
      draft.id,
      'release-1',
      onCatalogChanged,
    )

    expect(outcome.kind).toBe('failed')
    expect(loadStagedLocalEdits(draft.id)).toHaveLength(1)
    expect(window.location.pathname).toBe('/imports')
  })

  it('writes nothing when a staged file is not linked to the release', async () => {
    saveStagedLocalEdits(draft.id, [stagedEdit])
    catalogApi.loadRelease.mockResolvedValue({ tracklist: [] })

    const outcome = await finishConfirmedImport(
      draft.id,
      'release-1',
      onCatalogChanged,
    )

    expect(outcome.kind).toBe('failed')
    expect(apply).not.toHaveBeenCalled()
  })

  it('opens the release directly when nothing is staged', async () => {
    const outcome = await finishConfirmedImport(
      draft.id,
      'release-1',
      onCatalogChanged,
    )

    expect(outcome.kind).toBe('applied')
    expect(apply).not.toHaveBeenCalled()
    expect(window.location.search).toBe('?release=release-1')
  })
})
