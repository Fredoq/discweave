import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ExternalOriginalCandidateListDto } from '../catalog/api/catalogDtoTypes'
import {
  useOriginalTrackDiscovery,
  type ExternalOriginalCandidateLoader,
  type OriginalCandidateLoader,
} from './useOriginalTrackDiscovery'
import {
  deferred,
  externalResponse,
  localCandidate,
  localResponse,
  providerStatus,
} from './useOriginalTrackDiscovery.externalTestUtils'

const relationTypeOptions = [{ code: 'remixOf', label: 'Remix of' }]

describe('useOriginalTrackDiscovery external lifecycle', () => {
  it('aborts a provider-only retry when the hook unmounts', async () => {
    const retry = deferred<ExternalOriginalCandidateListDto>()
    const local = localResponse([localCandidate()])
    const loadExternalCandidates = vi
      .fn<ExternalOriginalCandidateLoader>()
      .mockResolvedValueOnce(
        externalResponse({
          local,
          providerStatuses: [providerStatus('musicbrainz', 'unavailable')],
        }),
      )
      .mockReturnValueOnce(retry.promise)
    const rendered = renderDiscovery(
      vi.fn<OriginalCandidateLoader>().mockResolvedValue(local),
      loadExternalCandidates,
    )
    await act(async () => {
      await rendered.result.current.open('source-track')
    })

    act(() => {
      void rendered.result.current.retryProvider('musicbrainz')
    })
    const retrySignal = loadExternalCandidates.mock.calls[1][1].signal
    rendered.unmount()

    expect(retrySignal.aborted).toBe(true)
    retry.resolve(externalResponse())
  })
})

function renderDiscovery(
  loadCandidates: OriginalCandidateLoader,
  loadExternalCandidates: ExternalOriginalCandidateLoader,
) {
  return renderHook(() =>
    useOriginalTrackDiscovery({
      relationTypeOptions,
      loadCandidates,
      loadExternalCandidates,
    }),
  )
}
