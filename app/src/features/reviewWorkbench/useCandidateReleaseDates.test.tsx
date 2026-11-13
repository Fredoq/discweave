import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getDiscogsRelease,
  type ExternalMetadataPartialDate,
  type ExternalMetadataReleaseDetailDto,
} from '../catalog/api/externalMetadataClient'
import { CatalogApiError } from '../catalog/api/httpClient'
import {
  candidateDateLabel,
  useCandidateReleaseDates,
} from './useCandidateReleaseDates'
import type { RankedDateCandidate } from './releaseDateSearch'
vi.mock('../catalog/api/externalMetadataClient', () => ({
  getDiscogsRelease: vi.fn(),
}))
function candidates(count: number): RankedDateCandidate[] {
  return Array.from({ length: count }, (_, i) => ({
    candidate: {
      source: {
        externalId: String(i + 1),
        providerName: 'Discogs',
        resourceType: 'release',
        sourceUrl: `https://www.discogs.com/release/${i + 1}`,
        attribution: 'Discogs',
      },
      title: `Album ${i + 1}`,
      artists: ['Artist'],
      labels: [],
      formats: [],
      barcodes: [],
    },
    score: count - i,
    matches: ['Artist'],
  }))
}
function detail(
  id: string,
  date: ExternalMetadataPartialDate | null,
): ExternalMetadataReleaseDetailDto {
  return {
    ...candidates(1)[0].candidate,
    source: { ...candidates(1)[0].candidate.source, externalId: id },
    releaseDateEvidence: date,
    tracklist: [],
    identifiers: [],
    credits: [],
    draft: {
      title: 'Album',
      genres: [],
      artistCredits: [],
      labels: [],
      tracklist: [],
      externalSources: [],
    },
  }
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getDiscogsRelease).mockImplementation((id) =>
    Promise.resolve(detail(id, { kind: 'year', year: 2000 })),
  )
})
describe('candidate date checks', () => {
  it('checks ten sequential editions then allows more, placing full dates first without hiding any', async () => {
    vi.mocked(getDiscogsRelease).mockImplementation((id) =>
      Promise.resolve(
        detail(
          id,
          id === '8'
            ? { kind: 'fullDate', year: 2000, month: 2, day: 3 }
            : { kind: 'year', year: 2000 },
        ),
      ),
    )
    const items = candidates(12)
    const { result } = renderHook(() => useCandidateReleaseDates(items, true))
    await waitFor(() => expect(result.current.checkingId).toBeNull())
    await waitFor(() => expect(result.current.checkedCount).toBe(10))
    expect(getDiscogsRelease).toHaveBeenCalledTimes(10)
    expect(result.current.ordered).toHaveLength(12)
    expect(result.current.ordered[0].candidate.source.externalId).toBe('8')
    expect(result.current.ordered[1].candidate.source.externalId).toBe('1')
    expect(candidateDateLabel(result.current.checks['8'], false)).toBe(
      'Full date: 2000-02-03',
    )
    expect(candidateDateLabel(result.current.checks['11'], false)).toBe(
      'Date not checked',
    )
    await act(() => result.current.checkMore())
    expect(getDiscogsRelease).toHaveBeenCalledTimes(12)
    expect(result.current.hasMore).toBe(false)
  })
  it('uses already enriched search evidence without additional requests including explicit missing dates', async () => {
    const items = candidates(3)
    for (const item of items) item.candidate.dateEvidenceChecked = true
    items[0].candidate.releaseDateEvidence = null
    items[1].candidate.releaseDateEvidence = {
      kind: 'yearMonth',
      year: 2000,
      month: 5,
    }
    items[2].candidate.releaseDateEvidence = {
      kind: 'fullDate',
      year: 2000,
      month: 5,
      day: 3,
    }
    const { result } = renderHook(() => useCandidateReleaseDates(items, true))
    await waitFor(() => expect(result.current.checkedCount).toBe(3))
    expect(getDiscogsRelease).not.toHaveBeenCalled()
    expect(result.current.ordered[0].candidate.source.externalId).toBe('3')
    expect(candidateDateLabel(result.current.checks['1'], false)).toBe(
      'No reliable date in source',
    )
    expect(candidateDateLabel(result.current.checks['2'], false)).toBe(
      'Month only: 2000-05',
    )
  })
  it('does not automatically repeat a failed backend detail lookup or turn its search year into a known date', async () => {
    const items = candidates(1)
    items[0].candidate.dateEvidenceChecked = false
    items[0].candidate.releaseDateEvidence = null
    items[0].candidate.year = 2000
    const { result } = renderHook(() => useCandidateReleaseDates(items, true))
    await act(async () => {
      await Promise.resolve()
    })
    expect(getDiscogsRelease).not.toHaveBeenCalled()
    expect(result.current.checks['1']).toBeUndefined()
    expect(result.current.hasMore).toBe(true)
    await act(() => result.current.checkMore())
    expect(getDiscogsRelease).toHaveBeenCalledTimes(1)
    expect(result.current.verifiedCount).toBe(1)
  })
  it('never issues a second request while the first is pending and aborts on unmount', async () => {
    let signal: AbortSignal | undefined
    vi.mocked(getDiscogsRelease).mockImplementation((_id, input) => {
      signal = input
      return new Promise(() => {})
    })
    const items = candidates(20)
    const { unmount } = renderHook(() => useCandidateReleaseDates(items, true))
    await waitFor(() => expect(getDiscogsRelease).toHaveBeenCalledTimes(1))
    unmount()
    expect(signal?.aborted).toBe(true)
    expect(getDiscogsRelease).toHaveBeenCalledTimes(1)
  })
  it('pauses for preview, ignores its late result, and resumes only through an explicit check after Back', async () => {
    let finish!: (value: ExternalMetadataReleaseDetailDto) => void
    let signal: AbortSignal | undefined
    vi.mocked(getDiscogsRelease).mockImplementationOnce((_id, input) => {
      signal = input
      return new Promise((resolve) => {
        finish = resolve
      })
    })
    const items = candidates(2)
    const { result, rerender } = renderHook(
      ({ enabled }) => useCandidateReleaseDates(items, enabled),
      { initialProps: { enabled: true } },
    )
    await waitFor(() => expect(getDiscogsRelease).toHaveBeenCalledTimes(1))
    rerender({ enabled: false })
    expect(signal?.aborted).toBe(true)
    rerender({ enabled: true })
    await act(async () => {
      finish(detail('1', { kind: 'fullDate', year: 2000, month: 1, day: 1 }))
      await Promise.resolve()
    })
    expect(getDiscogsRelease).toHaveBeenCalledTimes(1)
    expect(result.current.checks['1']).toBeUndefined()
    expect(result.current.checkingId).toBeNull()
    await act(() => result.current.checkMore())
    expect(getDiscogsRelease).toHaveBeenCalledTimes(3)
    expect(result.current.verifiedCount).toBe(2)
    expect(result.current.fullDateCount).toBe(0)
  })
  it('rejects mismatching editions and stops the batch without claiming a known date', async () => {
    vi.mocked(getDiscogsRelease).mockResolvedValue(
      detail('999', { kind: 'fullDate', year: 2000, month: 2, day: 3 }),
    )
    const items = candidates(5)
    const { result } = renderHook(() => useCandidateReleaseDates(items, true))
    await waitFor(() => expect(result.current.hasFailed).toBe(true))
    expect(result.current.checks['1']).toEqual({ status: 'failed' })
    expect(getDiscogsRelease).toHaveBeenCalledTimes(1)
    expect(result.current.notice).toMatch(/did not match/)
  })
  it('stops on rate limiting and retries only explicitly', async () => {
    const error = await CatalogApiError.fromResponse(
      new Response(
        JSON.stringify({
          code: 'rate_limited',
          message: 'Wait before retrying',
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.mocked(getDiscogsRelease).mockRejectedValueOnce(error)
    const items = candidates(5)
    const { result } = renderHook(() => useCandidateReleaseDates(items, true))
    await waitFor(() => expect(result.current.hasFailed).toBe(true))
    expect(getDiscogsRelease).toHaveBeenCalledTimes(1)
    await act(() => result.current.retryFailed())
    expect(getDiscogsRelease).toHaveBeenCalledTimes(2)
    expect(result.current.hasFailed).toBe(false)
    expect(result.current.hasMore).toBe(true)
  })
  it('discards stale responses after a new search', async () => {
    let finish!: (value: ExternalMetadataReleaseDetailDto) => void
    vi.mocked(getDiscogsRelease).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const old = candidates(1)
    const fresh = candidates(1)
    fresh[0].candidate.source.externalId = '2'
    const { result, rerender } = renderHook(
      ({ items }) => useCandidateReleaseDates(items, true),
      { initialProps: { items: old } },
    )
    await waitFor(() => expect(getDiscogsRelease).toHaveBeenCalledTimes(1))
    rerender({ items: fresh })
    await waitFor(() =>
      expect(result.current.checks['2']?.status).toBe('checked'),
    )
    await act(async () => {
      finish(detail('1', { kind: 'fullDate', year: 2000, month: 1, day: 1 }))
      await Promise.resolve()
    })
    expect(result.current.checks['1']).toBeUndefined()
    expect(result.current.ordered[0].candidate.source.externalId).toBe('2')
  })
})
