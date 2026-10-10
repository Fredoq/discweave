import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReleaseImportDraft } from '../catalog/catalogApi'
import { ImportLocalEditsSection } from './ImportLocalEditsSection'
import { loadStagedLocalEdits } from './importLocalEdits'

vi.mock('../catalog/catalogApi', () => ({
  loadRelease: vi.fn(),
  updateLocalAudioFile: vi.fn(),
  loadNamingProfiles: vi.fn().mockResolvedValue({
    items: [
      {
        id: 'profile-1',
        name: 'Default',
        releaseFolderTemplate: '{releaseArtists} - {title}',
        trackFileTemplate: '{position2} {title}',
        trackFileWithArtistTemplate: '{position2} {trackArtists} - {title}',
        sortOrder: 0,
        isDefault: true,
        isActive: true,
        isBuiltin: true,
      },
    ],
  }),
}))

const sourcePath = '/music/in/raw folder/track01.flac'

const draft = {
  id: 'draft-1',
  sourceKind: 'localFiles',
  status: 'ready',
  title: 'Album',
  type: 'album',
  isVariousArtists: false,
  notOnLabel: false,
  artistNames: ['Artist'],
  selectedArtistIds: [],
  artistSuggestions: [],
  genres: [],
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
  ],
} as unknown as ReleaseImportDraft

describe('ImportLocalEditsSection', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.discweaveDesktop = {
      isDesktop: true,
      localEdits: {
        apply: vi.fn(),
        preview: vi.fn(),
        inspect: vi.fn().mockResolvedValue({
          path: sourcePath,
          format: 'flac',
          sizeBytes: 1,
          lastModifiedAt: '2026-10-04T00:00:00.000Z',
          tags: { title: 'track01' },
          technical: { bitDepth: 16, durationSeconds: 1, sampleRate: 44100 },
        }),
      },
    } as unknown as Window['discweaveDesktop']
  })

  afterEach(() => {
    window.discweaveDesktop = undefined
  })

  it('stages profile renames and tag changes without writing files', async () => {
    const user = userEvent.setup()
    render(<ImportLocalEditsSection draft={draft} />)

    await user.click(
      screen.getByRole('button', { name: /prepare files and tags/i }),
    )
    await screen.findByDisplayValue('{releaseArtists} - {title}')
    await user.click(screen.getByRole('button', { name: /save for confirm/i }))

    const staged = loadStagedLocalEdits(draft.id)
    expect(staged).toHaveLength(1)
    expect(staged[0].currentPath).toBe(sourcePath)
    expect(staged[0].targetPath).toBe('/music/in/Artist - Album/01 Song.flac')
    expect(staged[0].targetTags.title).toBe('Song')
    expect(staged[0].tagChanges.title).toBe('Song')
    expect(window.discweaveDesktop?.localEdits?.apply).not.toHaveBeenCalled()
    expect(screen.getByText('1 file changes after confirm.')).toBeVisible()
  })

  it('keeps saving disabled until file tags are inspected', async () => {
    const user = userEvent.setup()
    const localEdits = window.discweaveDesktop?.localEdits
    vi.mocked(localEdits!.inspect).mockReturnValue(new Promise(() => {}))
    render(<ImportLocalEditsSection draft={draft} />)

    await user.click(
      screen.getByRole('button', { name: /prepare files and tags/i }),
    )
    await screen.findByDisplayValue('{releaseArtists} - {title}')

    expect(
      screen.getByRole('button', { name: /save for confirm/i }),
    ).toBeDisabled()
  })
})
