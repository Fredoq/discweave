import { describe, expect, it } from 'vitest'
import type {
  ImportFolderBaseline,
  ImportFolderBaselineDraft,
} from '../catalog/catalogApi'
import { diffWatchedFolder, type WatchedDiskFile } from './folderWatchDiff'

const root = '/music'
const modifiedAt = '2026-05-16T12:00:00.000Z'

function diskFile(filePath: string, sizeBytes = 10): WatchedDiskFile {
  return { filePath, sizeBytes, lastModifiedAt: modifiedAt }
}

function baselineDraft(
  draftId: string,
  status: ImportFolderBaselineDraft['status'],
  paths: string[],
  sizes: number[] = [],
): ImportFolderBaselineDraft {
  return {
    draftId: status === 'confirmed' ? null : draftId,
    status,
    sourcePath: paths[0].slice(0, paths[0].indexOf('/', root.length + 1)),
    releaseId: status === 'confirmed' ? draftId : null,
    title: draftId,
    files: paths.map((path, index) => ({
      path,
      sizeBytes: sizes[index] ?? 10,
      // The API serializes offsets differently from the desktop scanner.
      lastModifiedAt: '2026-05-16T12:00:00+00:00',
      localAudioFileId: status === 'confirmed' ? `file-${index}` : null,
    })),
  }
}

function baseline(
  drafts: ImportFolderBaselineDraft[],
  otherKnownPaths: string[] = [],
): ImportFolderBaseline {
  return { sourceRoot: root, drafts, otherKnownPaths }
}

describe('diffWatchedFolder', () => {
  it('reports nothing when disk matches the baseline', () => {
    const diff = diffWatchedFolder(
      baseline(
        [baselineDraft('a', 'confirmed', ['/music/A/01.flac'])],
        ['/music/Skipped/01.flac'],
      ),
      [diskFile('/music/A/01.flac'), diskFile('/music/Skipped/01.flac')],
    )

    expect(diff).toEqual({ newFilePaths: [], drafts: [] })
  })

  it('treats files in unknown folders and in the root as new releases', () => {
    const diff = diffWatchedFolder(
      baseline([
        baselineDraft('a', 'ready', ['/music/A/01.flac']),
        {
          ...baselineDraft('root', 'ready', ['/music/Single.flac']),
          sourcePath: root,
        },
      ]),
      [
        diskFile('/music/A/01.flac'),
        diskFile('/music/Single.flac'),
        diskFile('/music/Loose.flac'),
        diskFile('/music/New/CD1/01.flac'),
        diskFile('/music/A/Bonus/01.flac'),
      ],
    )

    expect(diff.drafts).toEqual([])
    expect(diff.newFilePaths).toEqual([
      '/music/A/Bonus/01.flac',
      '/music/Loose.flac',
      '/music/New/CD1/01.flac',
    ])
  })

  it('classifies renamed, moved, modified, added and missing files of a catalog release', () => {
    const diff = diffWatchedFolder(
      baseline([
        baselineDraft(
          'a',
          'confirmed',
          [
            '/music/A/CD1/01.flac',
            '/music/A/CD1/02.flac',
            '/music/A/CD1/03.flac',
            '/music/A/CD2/01.flac',
            '/music/A/CD2/02.flac',
          ],
          [11, 12, 13, 14, 15],
        ),
      ]),
      [
        diskFile('/music/A/CD1/01 Renamed.flac', 11),
        diskFile('/music/A/CD3/02.flac', 12),
        diskFile('/music/A/CD1/03.flac', 99),
        diskFile('/music/A/CD2/01.flac', 14),
        diskFile('/music/A/CD2/03 Added.flac', 16),
      ],
    )

    expect(diff.newFilePaths).toEqual([])
    expect(diff.drafts).toHaveLength(1)
    expect(diff.drafts[0]).toMatchObject({ key: 'a', inCatalog: true })
    expect(diff.drafts[0].changes).toEqual([
      { kind: 'added', path: '/music/A/CD2/03 Added.flac' },
      {
        kind: 'missing',
        path: '/music/A/CD2/02.flac',
        localAudioFileId: 'file-4',
      },
      {
        kind: 'modified',
        path: '/music/A/CD1/03.flac',
        localAudioFileId: 'file-2',
      },
      {
        kind: 'moved',
        path: '/music/A/CD3/02.flac',
        previousPath: '/music/A/CD1/02.flac',
        localAudioFileId: 'file-1',
      },
      {
        kind: 'renamed',
        path: '/music/A/CD1/01 Renamed.flac',
        previousPath: '/music/A/CD1/01.flac',
        localAudioFileId: 'file-0',
      },
    ])
    expect(diff.drafts[0].scanPaths).toEqual([
      '/music/A/CD1/01 Renamed.flac',
      '/music/A/CD1/03.flac',
      '/music/A/CD2/01.flac',
      '/music/A/CD2/03 Added.flac',
      '/music/A/CD3/02.flac',
    ])
  })

  it('does not guess a rename when several files share a fingerprint', () => {
    const diff = diffWatchedFolder(
      baseline([
        baselineDraft('a', 'ready', ['/music/A/01.flac', '/music/A/02.flac']),
      ]),
      [diskFile('/music/A/03.flac'), diskFile('/music/A/04.flac')],
    )

    expect(diff.drafts[0].inCatalog).toBe(false)
    expect(diff.drafts[0].changes.map((change) => change.kind)).toEqual([
      'added',
      'added',
      'missing',
      'missing',
    ])
  })

  it('gives new files to the pending reimport draft of a confirmed release and changes the signature', () => {
    const drafts = [
      baselineDraft('confirmed', 'confirmed', ['/music/A/01.flac']),
      baselineDraft('reimport', 'ready', [
        '/music/A/01.flac',
        '/music/A/02.flac',
      ]),
    ]
    const first = diffWatchedFolder(baseline(drafts), [
      diskFile('/music/A/01.flac'),
      diskFile('/music/A/02.flac'),
      diskFile('/music/A/03.flac'),
    ])
    const second = diffWatchedFolder(baseline(drafts), [
      diskFile('/music/A/01.flac'),
      diskFile('/music/A/02.flac'),
      diskFile('/music/A/04.flac'),
    ])

    expect(first.drafts.map((draft) => draft.key)).toEqual(['reimport'])
    expect(first.drafts[0].signature).not.toBe(second.drafts[0].signature)
  })
})
