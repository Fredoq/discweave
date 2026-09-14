import { describe, expect, it } from 'vitest'
import type { LocalEditableFile } from './localFileEditModel'
import {
  applyNamingProfile,
  tagChangesByDraftId,
  toDraft,
} from './localFileEditHelpers'
import type { InspectState, LocalEditableFileDraft } from './localFileEditTypes'

describe('localFileEditHelpers', () => {
  it('uses the digital track file link as row identity when a local file is reused', () => {
    const first = toDraft(editableFile('link-first', '1', 'First context'))
    const second = toDraft(editableFile('link-second', '2', 'Second context'))

    expect(first.rowId).toBe('link-first')
    expect(second.rowId).toBe('link-second')
  })

  it('keeps tag changes separate for reused local file rows', () => {
    const first = {
      ...toDraft(editableFile('link-first', '1', 'First context')),
      targetTags: { title: 'First context' },
    } as LocalEditableFileDraft
    const second = {
      ...toDraft(editableFile('link-second', '2', 'Second context')),
      targetTags: { title: 'Second context' },
    } as LocalEditableFileDraft
    const inspections: Record<string, InspectState> = {
      'link-first': {
        status: 'loaded',
        result: inspectResult('Embedded first'),
      },
      'link-second': {
        status: 'loaded',
        result: inspectResult('Embedded second'),
      },
    }

    const changes = tagChangesByDraftId([first, second], inspections)

    expect(changes.get('link-first')).toMatchObject({ title: 'First context' })
    expect(changes.get('link-second')).toMatchObject({
      title: 'Second context',
    })
  })

  it('renders the numeric disc in track file templates', () => {
    const profile = {
      id: 'multi-disc-profile',
      name: 'Multi-disc',
      releaseFolderTemplate: '{title}',
      trackFileTemplate: '{discNumber}-{position2} {title}',
      trackFileWithArtistTemplate: '{discNumber}-{position2} {title}',
      sortOrder: 1,
      isDefault: false,
      isActive: true,
      isBuiltin: false,
    }
    const drafts = [
      toDraft(editableFile('link-cd1', '1', 'Track 1', 'CD1')),
      toDraft(editableFile('link-cd2', '1', 'Track 1', 'CD2')),
    ]

    const named = applyNamingProfile(drafts, profile, {})

    expect(named.map((draft) => draft.targetPath)).toEqual([
      'Archive Release/1-01 Track 1.flac',
      'Archive Release/2-01 Track 1.flac',
    ])
  })
})

function editableFile(
  digitalTrackFileLinkId: string,
  position: string,
  title: string,
  disc?: string,
) {
  return {
    digitalTrackFileLinkId,
    localAudioFileId: 'shared-local-file',
    title,
    position,
    disc,
    trackArtists: 'Archive Artist',
    currentPath: `/archive/${position}.flac`,
    release: {
      title: 'Archive Release',
      artists: 'Archive Artist',
      year: '2026',
      label: 'Archive Label',
    },
    tags: { title },
  } as LocalEditableFile
}

function inspectResult(title: string) {
  return {
    path: '/archive/shared.flac',
    format: 'flac',
    sizeBytes: 100,
    lastModifiedAt: '2026-06-19T12:00:00.000Z',
    tags: { title },
    technical: {
      bitDepth: 16,
      durationSeconds: 180,
      sampleRate: 44100,
    },
  }
}
