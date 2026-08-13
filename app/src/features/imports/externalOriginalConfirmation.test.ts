import { describe, expect, it } from 'vitest'
import type {
  ReleaseImportConfirmationPreflight,
  ReleaseImportDraft,
} from '../catalog/catalogApi'
import { executeExternalOriginalConfirmation } from './externalOriginalConfirmation'

describe('executeExternalOriginalConfirmation', () => {
  it('runs confirmation after a successful preflight in one operation', async () => {
    const draft = externalDraft()
    const steps: string[] = []

    const result = await executeExternalOriginalConfirmation({
      draft,
      saveDraft: () => {
        steps.push('save')
        return Promise.resolve({ sessionId: 'session-1', draft })
      },
      preflight: () => {
        steps.push('preflight')
        return Promise.resolve(confirmationPreflight(true))
      },
      confirm: () => {
        steps.push('confirm')
        return Promise.resolve({ id: 'confirmed-session' })
      },
    })

    expect(result).toEqual({
      kind: 'confirmed',
      session: { id: 'confirmed-session' },
    })
    expect(steps).toEqual(['save', 'preflight', 'confirm'])
  })

  it('returns the blocking preflight without performing confirmation', async () => {
    const draft = externalDraft()
    const steps: string[] = []
    const blocked = confirmationPreflight(false)

    const result = await executeExternalOriginalConfirmation({
      draft,
      saveDraft: () => Promise.resolve({ sessionId: 'session-1', draft }),
      preflight: () => Promise.resolve(blocked),
      confirm: () => {
        steps.push('confirm')
        return Promise.resolve({ id: 'confirmed-session' })
      },
    })

    expect(result).toEqual({ kind: 'blocked', preflight: blocked })
    expect(steps).toEqual([])
  })
})

function externalDraft(): ReleaseImportDraft {
  return {
    id: 'draft-1',
    sourceKind: 'externalMetadata',
    sourcePath: null,
    relativePath: null,
    status: 'ready',
    title: 'External release',
    type: 'single',
    isVariousArtists: false,
    notOnLabel: false,
    artistNames: [],
    selectedArtistIds: [],
    artistSuggestions: [],
    genres: [],
    tags: [],
    issues: [],
    tracks: [],
  }
}

function confirmationPreflight(
  canConfirm: boolean,
): ReleaseImportConfirmationPreflight {
  return {
    sessionId: 'session-1',
    draftId: 'draft-1',
    draftStatus: 'ready',
    canConfirm,
    outcome: canConfirm ? 'newRelease' : 'blocked',
    summary: {
      includedTrackCount: 1,
      skippedTrackCount: 0,
      duplicateTrackCount: 0,
      newReleases: 1,
      reusedReleases: 0,
      updatedReleases: 0,
      newTracks: 1,
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
    actions: [],
    tracks: [],
    issues: canConfirm
      ? []
      : [
          {
            code: 'release_import.medium_required',
            message: 'Choose a collection medium.',
            severity: 'error',
          },
        ],
    blockingErrors: canConfirm
      ? []
      : [
          {
            code: 'release_import.medium_required',
            message: 'Choose a collection medium.',
            severity: 'error',
          },
        ],
  }
}
