import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type {
  ExternalOriginalCandidateListDto,
  ExternalReleaseDraftRequestDto,
} from '../catalog/api/catalogDtoTypes'
import type { ReleaseImportSession } from '../catalog/api/catalogImportTypes'
import {
  useOriginalTrackDiscovery,
  type ExternalOriginalCandidateLoader,
  type OriginalCandidateLoader,
} from './useOriginalTrackDiscovery'
import {
  catalogError,
  deferred,
  externalCandidate,
  externalResponse,
  localCandidate,
  localResponse,
  providerStatus,
  recordingSource,
  releaseRoute,
} from './useOriginalTrackDiscovery.externalTestUtils'
import { externalReleaseRouteKey } from './originalTrackDiscoveryExternalDraft'

const relationTypeOptions = [{ code: 'remixOf', label: 'Remix of' }]

describe('useOriginalTrackDiscovery external lifecycle', () => {
  it('loads releases first and appends deep candidates on demand', async () => {
    const local = localResponse([])
    const quickCandidate = externalCandidate({
      candidateKey: 'quick-recording',
      title: 'Anomaly Calling Your Name',
      releaseRoutes: [releaseRoute('quick-release')],
    })
    const deepCandidate = externalCandidate({
      candidateKey: 'deep-recording',
      title: 'Anomally, Calling Your Name (original mix)',
      releaseRoutes: [releaseRoute('deep-release')],
    })
    const loadExternalCandidates = vi
      .fn<ExternalOriginalCandidateLoader>()
      .mockResolvedValueOnce(
        externalResponse({ local, items: [quickCandidate] }),
      )
      .mockResolvedValueOnce(
        externalResponse({ local, items: [deepCandidate] }),
      )
    const { result } = renderDiscovery(
      vi.fn<OriginalCandidateLoader>().mockResolvedValue(local),
      loadExternalCandidates,
    )

    await act(async () => {
      await result.current.open('source-track')
    })

    expect(loadExternalCandidates.mock.calls[0][1].searchMode).toBe(
      'releaseFirst',
    )
    expect(result.current.state.releaseCandidates).toEqual([quickCandidate])
    expect(result.current.state.deepCandidates).toEqual([])

    const selectedRouteKey = externalReleaseRouteKey(
      quickCandidate.releaseRoutes[0],
    )
    act(() => {
      result.current.selectReleaseCandidate(
        quickCandidate.candidateKey,
        selectedRouteKey,
      )
    })
    act(() => {
      result.current.continueToReview()
    })
    expect(result.current.state).toMatchObject({
      selectedCandidateKey: 'external:quick-recording',
      selectedExternalRouteKey: selectedRouteKey,
      step: 'review',
    })
    act(() => {
      result.current.backToCandidates()
    })

    await act(async () => {
      await result.current.searchDeeper()
    })

    expect(loadExternalCandidates.mock.calls[1][1].searchMode).toBe('deep')
    expect(result.current.state.releaseCandidates).toEqual([quickCandidate])
    expect(result.current.state.deepCandidates).toEqual([deepCandidate])
    expect(result.current.state.deepSearchStatus).toBe('loaded')
  })

  it('creates an external draft from the selected MusicBrainz route and preserves retry identity', async () => {
    const local = localResponse([localCandidate()])
    const response = externalResponse({
      local,
      items: [
        externalCandidate({
          releaseRoutes: [releaseRoute('release-mbid', 'musicbrainz')],
        }),
      ],
    })
    const createExternalDraft = vi
      .fn<
        (
          request: ExternalReleaseDraftRequestDto,
          options: Readonly<{ signal: AbortSignal }>,
        ) => Promise<ReleaseImportSession>
      >()
      .mockResolvedValue({} as ReleaseImportSession)
    const onExternalDraftCreated = vi.fn()
    const { result } = renderHook(() =>
      useOriginalTrackDiscovery({
        relationTypeOptions,
        loadCandidates: vi.fn().mockResolvedValue(local),
        loadExternalCandidates: vi.fn().mockResolvedValue(response),
        createExternalDraft,
        onExternalDraftCreated,
      }),
    )

    await act(async () => {
      await result.current.open('source-track')
    })
    act(() => {
      result.current.selectCandidate(
        'external:musicbrainz:recording:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      )
    })
    act(() => {
      result.current.continueToReview()
    })
    await act(async () => {
      await result.current.confirmExternal()
    })

    expect(createExternalDraft).toHaveBeenCalledTimes(1)
    const [request, options] = createExternalDraft.mock.calls[0]
    expect(request).toMatchObject({
      sourceTrackId: 'source-track',
      recordingMbid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      musicBrainzRow: {
        releaseMbid: 'release-mbid',
        mediumPosition: '1',
        trackMbid: 'release-mbid-track',
      },
      reviewedRelationTypeCode: 'remixOf',
    })
    expect(request.idempotencyKey).toEqual(expect.any(String))
    expect(request).not.toHaveProperty('sourceUrl')
    expect(options.signal).toBeInstanceOf(AbortSignal)
    expect(onExternalDraftCreated).toHaveBeenCalledTimes(1)
    expect(result.current.state.isOpen).toBe(false)
  })

  it('preserves explicit interaction state when an exact attached Recording appends', async () => {
    const external = deferred<ExternalOriginalCandidateListDto>()
    const local = localResponse([localCandidate()])
    const loadExternalCandidates = vi
      .fn<ExternalOriginalCandidateLoader>()
      .mockReturnValue(external.promise)
    const { result } = renderDiscovery(
      vi.fn<OriginalCandidateLoader>().mockResolvedValue(local),
      loadExternalCandidates,
    )

    let opening!: Promise<void>
    act(() => {
      opening = result.current.open('source-track')
    })
    await waitFor(() =>
      expect(result.current.state.externalStatus).toBe('loading'),
    )
    act(() => {
      result.current.selectCandidate('local-medium')
      result.current.setCandidateScrollOffset(149)
    })

    external.resolve(
      externalResponse({
        local,
        items: [
          externalCandidate({
            localTrackId: 'local-medium-track',
            title: 'Provider title remains authoritative',
            artists: ['Provider Artist'],
          }),
        ],
      }),
    )
    await act(async () => {
      await opening
    })

    expect(result.current.state.candidates).toHaveLength(1)
    expect(result.current.state.candidates[0]).toMatchObject({
      candidateKey: 'local-medium',
      kind: 'combined',
      title: 'Provider title remains authoritative',
      artistDisplay: 'Provider Artist',
      durationSeconds: null,
      origins: ['local', 'musicbrainz'],
    })
    expect(result.current.state).toMatchObject({
      selectedCandidateKey: 'local-medium',
      candidateScrollOffset: 149,
    })
  })

  it('does not combine an attached local Track when the Recording MBID is malformed', async () => {
    const local = localResponse([localCandidate()])
    const { result } = renderDiscovery(
      vi.fn<OriginalCandidateLoader>().mockResolvedValue(local),
      vi.fn<ExternalOriginalCandidateLoader>().mockResolvedValue(
        externalResponse({
          local,
          items: [
            externalCandidate({
              localTrackId: 'local-medium-track',
              recordingSource: {
                ...recordingSource(),
                externalId: 'not-an-mbid',
              },
            }),
          ],
        }),
      ),
    )

    await act(async () => {
      await result.current.open('source-track')
    })

    expect(result.current.state.candidates).toHaveLength(2)
    expect(result.current.state.selectedCandidateKey).toBeNull()
  })

  it('replaces the retried provider batch without reviving stale same-MBID data', async () => {
    const local = localResponse([localCandidate()])
    const shared = externalCandidate({
      origins: ['musicbrainz', 'discogs'],
      supportingEvidence: [
        { code: 'directedLineage', channel: 'musicBrainz' },
        { code: 'creditsSupport', channel: 'discogs' },
      ],
      releaseRoutes: [releaseRoute('stale-route')],
    })
    const independent = externalCandidate({
      candidateKey: 'discogs:recording:independent',
      recordingSource: {
        providerCode: 'discogs',
        resourceType: 'recording',
        externalId: 'independent',
        sourceUrl: 'https://www.discogs.com/release/independent',
        attribution: 'Discogs',
      },
      title: 'Independent Discogs candidate',
      origins: ['discogs'],
      supportingEvidence: [{ code: 'creditsSupport', channel: 'discogs' }],
      releaseRoutes: [releaseRoute('independent-route', 'discogs')],
    })
    const loadExternalCandidates = vi
      .fn<ExternalOriginalCandidateLoader>()
      .mockResolvedValueOnce(
        externalResponse({
          local,
          items: [shared, independent],
          providerStatuses: [
            providerStatus('discogs', 'succeeded'),
            providerStatus('musicbrainz', 'unavailable'),
          ],
          warnings: ['discogs.context', 'shared.warning'],
        }),
      )
      .mockResolvedValueOnce(
        externalResponse({
          local,
          items: [
            externalCandidate({
              title: 'Fresh MusicBrainz title',
              supportingEvidence: [
                { code: 'earlierChronology', channel: 'musicBrainz' },
              ],
              releaseRoutes: [releaseRoute('fresh-route')],
            }),
          ],
          providerStatuses: [providerStatus('musicbrainz', 'succeeded')],
          warnings: ['musicbrainz.recovered', 'shared.warning'],
        }),
      )
    const { result } = renderDiscovery(
      vi.fn<OriginalCandidateLoader>().mockResolvedValue(local),
      loadExternalCandidates,
    )
    await act(async () => {
      await result.current.open('source-track')
    })

    await act(async () => {
      await result.current.retryProvider('musicbrainz')
    })

    expect(loadExternalCandidates.mock.calls[1][1].providerCodes).toEqual([
      'musicbrainz',
    ])
    expect(result.current.state.providerStatuses).toEqual([
      providerStatus('discogs', 'succeeded'),
      providerStatus('musicbrainz', 'succeeded'),
    ])
    expect(result.current.state.externalWarnings).toEqual([
      'discogs.context',
      'musicbrainz.recovered',
      'shared.warning',
    ])
    const refreshed = result.current.state.externalCandidates.find(
      (candidate) => candidate.recordingSource?.providerCode === 'musicbrainz',
    )
    expect(refreshed).toMatchObject({
      title: 'Fresh MusicBrainz title',
      origins: ['musicbrainz'],
    })
    expect(refreshed?.supportingEvidence).toEqual([
      { code: 'earlierChronology', channel: 'musicBrainz' },
    ])
    expect(refreshed?.releaseRoutes).toEqual([releaseRoute('fresh-route')])
    expect(result.current.state.externalCandidates).toContainEqual(independent)
    expect(
      result.current.state.externalCandidates.some((candidate) =>
        candidate.releaseRoutes.some(
          (route) => route.releaseSource.externalId === 'stale-route',
        ),
      ),
    ).toBe(false)
  })

  it('publishes releases discovered by a provider retry to the release-first state', async () => {
    const local = localResponse([])
    const initial = externalCandidate({
      releaseRoutes: [],
    })
    const refreshed = externalCandidate({
      releaseRoutes: [releaseRoute('retried-release')],
    })
    const loadExternalCandidates = vi
      .fn<ExternalOriginalCandidateLoader>()
      .mockResolvedValueOnce(externalResponse({ local, items: [initial] }))
      .mockResolvedValueOnce(externalResponse({ local, items: [refreshed] }))
    const { result } = renderDiscovery(
      vi.fn<OriginalCandidateLoader>().mockResolvedValue(local),
      loadExternalCandidates,
    )

    await act(async () => {
      await result.current.open('source-track')
    })
    expect(result.current.state.releaseCandidates).toEqual([initial])

    await act(async () => {
      await result.current.retryProvider('musicbrainz')
    })

    expect(result.current.state.releaseCandidates).toEqual([refreshed])
  })

  it('performs one final local refresh after the authoritative 409', async () => {
    const medium = localResponse([localCandidate()])
    const high = localResponse([localCandidate({ confidence: 'high' })], true)
    const loadCandidates = vi
      .fn<OriginalCandidateLoader>()
      .mockResolvedValueOnce(medium)
      .mockResolvedValueOnce(high)
    const loadExternalCandidates = vi
      .fn<ExternalOriginalCandidateLoader>()
      .mockRejectedValue(
        await catalogError(409, 'original_discovery.local_candidate_available'),
      )
    const { result } = renderDiscovery(loadCandidates, loadExternalCandidates)

    await act(async () => {
      await result.current.open('source-track')
    })

    expect(loadCandidates).toHaveBeenCalledTimes(2)
    expect(loadExternalCandidates).toHaveBeenCalledTimes(1)
    expect(result.current.state).toMatchObject({
      status: 'loaded',
      externalStatus: 'loaded',
      hasReliableLocalCandidate: true,
      discoveryError: '',
      externalError: '',
    })
  })

  it('handles the authoritative 409 during retry with one local refresh', async () => {
    const medium = localResponse([localCandidate()])
    const high = localResponse([localCandidate({ confidence: 'high' })], true)
    const loadCandidates = vi
      .fn<OriginalCandidateLoader>()
      .mockResolvedValueOnce(medium)
      .mockResolvedValueOnce(high)
    const loadExternalCandidates = vi
      .fn<ExternalOriginalCandidateLoader>()
      .mockResolvedValueOnce(
        externalResponse({
          local: medium,
          providerStatuses: [providerStatus('musicbrainz', 'unavailable')],
        }),
      )
      .mockRejectedValueOnce(
        await catalogError(409, 'original_discovery.local_candidate_available'),
      )
    const { result } = renderDiscovery(loadCandidates, loadExternalCandidates)
    await act(async () => {
      await result.current.open('source-track')
    })

    await act(async () => {
      await result.current.retryProvider('musicbrainz')
    })

    expect(loadCandidates).toHaveBeenCalledTimes(2)
    expect(loadExternalCandidates).toHaveBeenCalledTimes(2)
    expect(result.current.state).toMatchObject({
      status: 'loaded',
      externalStatus: 'loaded',
      hasReliableLocalCandidate: true,
      providerStatuses: [],
      externalError: '',
    })
  })

  it('aborts external loading on close, unmount, and source replacement', async () => {
    const firstExternal = deferred<ExternalOriginalCandidateListDto>()
    const secondExternal = deferred<ExternalOriginalCandidateListDto>()
    const thirdExternal = deferred<ExternalOriginalCandidateListDto>()
    const loadExternalCandidates = vi
      .fn<ExternalOriginalCandidateLoader>()
      .mockReturnValueOnce(firstExternal.promise)
      .mockReturnValueOnce(secondExternal.promise)
      .mockReturnValueOnce(thirdExternal.promise)
    const loadCandidates = vi
      .fn<OriginalCandidateLoader>()
      .mockResolvedValue(localResponse([localCandidate()]))
    const rendered = renderDiscovery(loadCandidates, loadExternalCandidates)

    let firstOpen!: Promise<void>
    act(() => {
      firstOpen = rendered.result.current.open('first-source')
    })
    await waitFor(() => expect(loadExternalCandidates).toHaveBeenCalledTimes(1))
    const firstSignal = loadExternalCandidates.mock.calls[0][1].signal
    let secondOpen!: Promise<void>
    act(() => {
      secondOpen = rendered.result.current.open('second-source')
    })
    expect(firstSignal.aborted).toBe(true)
    await waitFor(() => expect(loadExternalCandidates).toHaveBeenCalledTimes(2))
    const secondSignal = loadExternalCandidates.mock.calls[1][1].signal
    act(() => {
      rendered.result.current.close()
    })
    expect(secondSignal.aborted).toBe(true)
    firstExternal.resolve(externalResponse())
    secondExternal.resolve(externalResponse())
    await act(async () => {
      await Promise.all([firstOpen, secondOpen])
    })
    expect(rendered.result.current.state.isOpen).toBe(false)

    let thirdOpen!: Promise<void>
    act(() => {
      thirdOpen = rendered.result.current.open('third-source')
    })
    await waitFor(() => expect(loadExternalCandidates).toHaveBeenCalledTimes(3))
    const thirdSignal = loadExternalCandidates.mock.calls[2][1].signal
    rendered.unmount()
    expect(thirdSignal.aborted).toBe(true)
    thirdExternal.resolve(externalResponse())
    thirdOpen.catch(() => undefined)
  })

  it('aborts a provider-only retry when the dialog closes', async () => {
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
    const { result } = renderDiscovery(
      vi.fn<OriginalCandidateLoader>().mockResolvedValue(local),
      loadExternalCandidates,
    )
    await act(async () => {
      await result.current.open('source-track')
    })

    let retrying!: Promise<void>
    act(() => {
      retrying = result.current.retryProvider('musicbrainz')
    })
    const signal = loadExternalCandidates.mock.calls[1][1].signal
    act(() => {
      result.current.close()
    })
    expect(signal.aborted).toBe(true)
    retry.resolve(externalResponse())
    await act(async () => {
      await retrying
    })
    expect(result.current.state.isOpen).toBe(false)
  })

  it('aborts and suppresses a retry when a replacement source opens', async () => {
    const retry = deferred<ExternalOriginalCandidateListDto>()
    const medium = localResponse([localCandidate()])
    const replacement = localResponse(
      [
        localCandidate({
          candidateKey: 'replacement-high',
          confidence: 'high',
        }),
      ],
      true,
    )
    const loadCandidates = vi
      .fn<OriginalCandidateLoader>()
      .mockResolvedValueOnce(medium)
      .mockResolvedValueOnce(replacement)
    const loadExternalCandidates = vi
      .fn<ExternalOriginalCandidateLoader>()
      .mockResolvedValueOnce(
        externalResponse({
          local: medium,
          providerStatuses: [providerStatus('musicbrainz', 'unavailable')],
        }),
      )
      .mockReturnValueOnce(retry.promise)
    const { result } = renderDiscovery(loadCandidates, loadExternalCandidates)
    await act(async () => {
      await result.current.open('source-track')
    })

    let retrying!: Promise<void>
    act(() => {
      retrying = result.current.retryProvider('musicbrainz')
    })
    const retrySignal = loadExternalCandidates.mock.calls[1][1].signal
    await act(async () => {
      await result.current.open('replacement-source')
    })
    expect(retrySignal.aborted).toBe(true)
    retry.resolve(
      externalResponse({
        items: [externalCandidate({ title: 'Stale retry result' })],
      }),
    )
    await act(async () => {
      await retrying
    })

    expect(result.current.state.sourceTrackId).toBe('replacement-source')
    expect(result.current.state.candidates).toHaveLength(1)
    expect(result.current.state.candidates[0].candidateKey).toBe(
      'replacement-high',
    )
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
