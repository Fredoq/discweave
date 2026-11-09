import { describe, expect, it, vi } from 'vitest'
import * as h from '../../test/appTestHarness'
import type {
  ImportRelationSuggestion,
  ReleaseImportConfirmationPreflight,
  ReleaseImportDraft,
} from '../catalog/catalogApi'
import { ImportConfirmationDialog } from './ImportConfirmationDialog'

h.setupAppTestHooks()

const draft: ReleaseImportDraft = {
  id: 'draft',
  sourceKind: 'localFiles',
  sourcePath: '/example',
  relativePath: 'example',
  status: 'ready',
  title: 'Example',
  type: 'album',
  isVariousArtists: false,
  notOnLabel: true,
  artistNames: [],
  selectedArtistIds: [],
  artistSuggestions: [],
  genres: [],
  tags: [],
  issues: [],
  tracks: [],
}
const preflight: ReleaseImportConfirmationPreflight = {
  sessionId: 'session',
  draftId: 'draft',
  draftStatus: 'ready',
  canConfirm: true,
  outcome: 'newRelease',
  actions: [],
  tracks: [],
  issues: [],
  blockingErrors: [],
  summary: {
    includedTrackCount: 0,
    skippedTrackCount: 0,
    duplicateTrackCount: 0,
    newReleases: 1,
    reusedReleases: 0,
    updatedReleases: 0,
    newTracks: 0,
    reusedTracks: 0,
    releaseOnlyTracks: 0,
    newDigitalOwnedItems: 0,
    reusedDigitalOwnedItems: 0,
    newLocalAudioFiles: 0,
    updatedLocalAudioFiles: 0,
    newDigitalTrackFileLinks: 0,
    relinkedDigitalTrackFileLinks: 0,
    unchangedDigitalTrackFileLinks: 0,
  },
}
const payload = {
  source: { kind: 'draftTrack' as const, id: 'source' },
  target: null,
  relationTypeCode: null,
}
const suggestions: ImportRelationSuggestion[] = [
  'pending',
  'accepted',
  'rejected',
].map((decision, index) => ({
  id: String(index),
  draftId: 'draft',
  token: 'Mix',
  confidence: 80,
  decision: decision as ImportRelationSuggestion['decision'],
  applicationMode: 'bestEffort',
  isModified: false,
  suggested: payload,
  reviewed: payload,
  targetOptions: [],
}))

describe('import confirmation relation review', () => {
  it('shows decisions without blocking optional pending suggestions or accepting them', async () => {
    const confirm = vi.fn()
    const cancel = vi.fn()
    const user = h.userEvent.setup()
    h.render(
      <ImportConfirmationDialog
        draft={draft}
        preflight={preflight}
        relationSuggestions={suggestions}
        isConfirming={false}
        onConfirm={confirm}
        onCancel={cancel}
      />,
    )
    expect(
      h.screen.getByText('1 pending · 1 accepted · 1 rejected'),
    ).toBeVisible()
    expect(
      h.screen.getByRole('button', { name: 'Confirm import' }),
    ).toBeEnabled()
    await user.click(h.screen.getByRole('button', { name: 'Cancel' }))
    expect(cancel).toHaveBeenCalledOnce()
    expect(confirm).not.toHaveBeenCalled()
    await user.click(h.screen.getByRole('button', { name: 'Confirm import' }))
    expect(confirm).toHaveBeenCalledOnce()
    expect(suggestions[0].decision).toBe('pending')
  })
})
