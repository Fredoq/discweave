import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useOriginalTrackDiscovery } from './useOriginalTrackDiscovery'
import {
  externalCandidate,
  externalResponse,
  localResponse,
  releaseRoute,
} from './useOriginalTrackDiscovery.externalTestUtils'
import { externalReleaseRouteKey } from './originalTrackDiscoveryExternalDraft'

it('reviews and submits a Discogs-only original without MusicBrainz identifiers', async () => {
  const local = localResponse([])
  const source = {
    providerCode: 'discogs',
    resourceType: 'release',
    externalId: '12345',
    sourceUrl: 'https://www.discogs.com/release/12345',
    attribution: 'Discogs',
  }
  const route = {
    ...releaseRoute('12345'),
    releaseSource: source,
    releaseGroupSource: null,
    musicBrainzTrackMbid: null,
    discogsBinding: {
      releaseSource: source,
      rowOrdinal: 0,
      position: '1',
      fingerprint: 'a'.repeat(64),
    },
  }
  const candidate = externalCandidate({
    candidateKey: 'discogs:12345:0',
    recordingSource: null,
    title: 'Nice',
    origins: ['discogs'],
    releaseRoutes: [route],
  })
  const createExternalDraft = vi.fn().mockResolvedValue({ id: 'draft-session' })
  const onExternalDraftCreated = vi.fn()
  const { result } = renderHook(() =>
    useOriginalTrackDiscovery({
      relationTypeOptions: [{ code: 'remixOf', label: 'Remix of' }],
      loadCandidates: vi.fn().mockResolvedValue(local),
      loadExternalCandidates: vi
        .fn()
        .mockResolvedValue(externalResponse({ local, items: [candidate] })),
      createExternalDraft,
      onExternalDraftCreated,
    }),
  )
  await act(async () => {
    await result.current.open('source-track')
  })
  expect(result.current.state.selectedCandidateKey).toBeNull()
  act(() => {
    result.current.selectReleaseCandidate(
      candidate.candidateKey,
      externalReleaseRouteKey(route),
    )
  })
  act(() => {
    result.current.continueToReview()
  })
  await act(async () => {
    expect(await result.current.confirmExternal()).toBe(true)
  })
  expect(createExternalDraft.mock.calls[0][0]).toEqual({
    sourceTrackId: 'source-track',
    reviewedRelationTypeCode: 'remixOf',
    idempotencyKey: expect.any(String) as string,
    discogsRoute: {
      releaseId: '12345',
      rowOrdinal: 0,
      position: '1',
      fingerprint: 'a'.repeat(64),
    },
  })
  expect(onExternalDraftCreated).toHaveBeenCalledWith({ id: 'draft-session' })
})
