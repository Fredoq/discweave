import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  LocalOriginalCandidateDto,
  LocalOriginalCandidateListDto,
} from '../catalog/api/catalogDtoTypes'
import { CatalogApiError } from '../catalog/api/httpClient'
import {
  buildOriginalCandidateStackCommand,
  confidenceLabel,
  evidenceGroups,
  findOriginalCandidate,
  initialOriginalCandidateRelationType,
} from './originalTrackDiscoveryModel'
import {
  useOriginalTrackDiscovery,
  type OriginalCandidateConfirmation,
  type OriginalCandidateLoader,
} from './useOriginalTrackDiscovery'

afterEach(() => {
  vi.restoreAllMocks()
})

const relationTypeOptions = [
  { code: 'remixOf', label: 'Remix of' },
  { code: 'versionOf', label: 'Version of' },
]

describe('original track discovery model', () => {
  it('maps confidence labels and keeps evidence in separate stable groups', () => {
    const candidate = candidateFixture({
      supportingEvidence: [
        { code: 'identityMatch', channel: 'localCatalog' },
      ],
      contradictions: [
        { code: 'laterChronology', channel: 'discogs' },
      ],
      missingEvidence: [
        { code: 'missingDuration', channel: 'musicBrainz' },
      ],
    })

    expect(confidenceLabel('high')).toBe('High confidence')
    expect(confidenceLabel('medium')).toBe('Medium confidence')
    expect(confidenceLabel('low')).toBe('Low confidence')
    expect(evidenceGroups(candidate)).toEqual([
      {
        key: 'supporting',
        label: 'Supporting evidence',
        items: candidate.supportingEvidence,
      },
      {
        key: 'contradictions',
        label: 'Contradictions',
        items: candidate.contradictions,
      },
      {
        key: 'missing',
        label: 'Missing evidence',
        items: candidate.missingEvidence,
      },
    ])
  })

  it('uses candidateKey for lookup and enables suggestions only when configured', () => {
    const candidate = candidateFixture({
      candidateKey: 'stable-candidate-key',
      localTrackId: 'local-track-id',
      suggestedRelationTypeCode: 'remixOf',
    })

    expect(
      findOriginalCandidate([candidate], 'stable-candidate-key'),
    ).toBe(candidate)
    expect(findOriginalCandidate([candidate], 'local-track-id')).toBeNull()
    expect(
      initialOriginalCandidateRelationType(candidate, relationTypeOptions),
    ).toEqual(relationTypeOptions[0])
    expect(
      initialOriginalCandidateRelationType(candidate, [
        relationTypeOptions[1],
      ]),
    ).toBeNull()
  })

  it('builds stack commands from localTrackId and rejects unavailable diagnostics', () => {
    const candidate = candidateFixture({
      candidateKey: 'provider:recording:key',
      localTrackId: 'catalog-track-id',
      requiresPromotion: true,
    })

    expect(
      buildOriginalCandidateStackCommand(
        'source-track',
        candidate,
        'remixOf',
      ),
    ).toEqual({
      sourceTrackId: 'source-track',
      targetRootTrackId: 'catalog-track-id',
      relationTypeCode: 'remixOf',
      markTargetAsOriginal: true,
    })
    expect(
      buildOriginalCandidateStackCommand(
        'source-track',
        candidateFixture({ selectable: false, confidence: 'low' }),
        'remixOf',
      ),
    ).toBeNull()
    expect(
      buildOriginalCandidateStackCommand(
        'source-track',
        null,
        'remixOf',
      ),
    ).toBeNull()
  })
})

describe('useOriginalTrackDiscovery', () => {
  it('starts idle, loads explicitly, and never auto-selects a sole High candidate', async () => {
    const load = deferred<LocalOriginalCandidateListDto>()
    const loadCandidates = vi
      .fn<OriginalCandidateLoader>()
      .mockReturnValue(load.promise)
    const { result } = renderDiscovery(loadCandidates)

    expect(result.current.state).toMatchObject({
      isOpen: false,
      status: 'idle',
      selectedCandidateKey: null,
    })

    let openPromise!: Promise<void>
    act(() => {
      openPromise = result.current.open('source-track')
    })
    expect(result.current.state).toMatchObject({
      isOpen: true,
      sourceTrackId: 'source-track',
      status: 'loading',
      selectedCandidateKey: null,
    })

    load.resolve(responseFixture([candidateFixture()]))
    await act(async () => {
      await openPromise
    })
    expect(result.current.state).toMatchObject({
      status: 'loaded',
      hasReliableLocalCandidate: true,
      selectedCandidateKey: null,
    })
    expect(result.current.selectedCandidate).toBeNull()
  })

  it('keeps Low diagnostic rows in the semantic empty state', async () => {
    const low = candidateFixture({
      candidateKey: 'low-diagnostic',
      confidence: 'low',
      selectable: false,
    })
    const loadCandidates = vi
      .fn<OriginalCandidateLoader>()
      .mockResolvedValue(responseFixture([low], false))
    const { result } = renderDiscovery(loadCandidates)

    await act(async () => {
      await result.current.open('source-track')
    })
    expect(result.current.state.status).toBe('empty')
    expect(result.current.state.candidates).toEqual([low])
    expect(result.current.state.selectedCandidateKey).toBeNull()
  })

  it.each([
    [404, 'track.not_found', 'source-not-found'],
    [
      409,
      'original_discovery.source_not_eligible',
      'source-not-eligible',
    ],
    [404, 'catalog.unrelated_not_found', 'retryable-error'],
    [409, 'catalog.unrelated_conflict', 'retryable-error'],
  ] as const)(
    'maps HTTP %i semantic failures to terminal state %s',
    async (status, code, expectedStatus) => {
      const error = await catalogError(status, code)
      const loadCandidates = vi
        .fn<OriginalCandidateLoader>()
        .mockRejectedValue(error)
      const { result } = renderDiscovery(loadCandidates)

      await act(async () => {
        await result.current.open('source-track')
      })
      expect(result.current.state).toMatchObject({
        status: expectedStatus,
        discoveryErrorCode: code,
        discoveryError: error.message,
      })
      if (expectedStatus !== 'retryable-error') {
        await act(async () => {
          await result.current.retryLocal()
        })
        expect(loadCandidates).toHaveBeenCalledTimes(1)
      }
    },
  )

  it('treats network failures as retryable and retries the same source', async () => {
    const loadCandidates = vi
      .fn<OriginalCandidateLoader>()
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(responseFixture([]))
    const { result } = renderDiscovery(loadCandidates)

    await act(async () => {
      await result.current.open('source-track')
    })
    expect(result.current.state).toMatchObject({
      status: 'retryable-error',
      discoveryError: 'Network request failed',
    })

    await act(async () => {
      await result.current.retryLocal()
    })
    expect(loadCandidates).toHaveBeenCalledTimes(2)
    expect(loadCandidates.mock.calls[1][0]).toBe('source-track')
    expect(result.current.state.status).toBe('empty')
  })

  it('aborts replaced requests and ignores their stale completion', async () => {
    const first = deferred<LocalOriginalCandidateListDto>()
    const second = deferred<LocalOriginalCandidateListDto>()
    const loadCandidates = vi
      .fn<OriginalCandidateLoader>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const { result } = renderDiscovery(loadCandidates)

    let firstOpen!: Promise<void>
    let secondOpen!: Promise<void>
    act(() => {
      firstOpen = result.current.open('first-source')
      secondOpen = result.current.open('second-source')
    })

    const firstSignal = loadCandidates.mock.calls[0][1].signal
    const secondCandidate = candidateFixture({
      candidateKey: 'second-result',
    })
    expect(firstSignal.aborted).toBe(true)
    second.resolve(responseFixture([secondCandidate]))
    await act(async () => {
      await secondOpen
    })
    first.resolve(
      responseFixture([
        candidateFixture({ candidateKey: 'stale-first-result' }),
      ]),
    )
    await act(async () => {
      await firstOpen
    })
    expect(result.current.state.sourceTrackId).toBe('second-source')
    expect(result.current.state.candidates).toEqual([secondCandidate])
  })

  it('aborts on close and suppresses completion after returning to idle', async () => {
    const load = deferred<LocalOriginalCandidateListDto>()
    const loadCandidates = vi
      .fn<OriginalCandidateLoader>()
      .mockReturnValue(load.promise)
    const { result } = renderDiscovery(loadCandidates)

    let openPromise!: Promise<void>
    act(() => {
      openPromise = result.current.open('source-track')
    })
    const signal = loadCandidates.mock.calls[0][1].signal
    act(() => {
      expect(result.current.close()).toBe(true)
    })
    expect(signal.aborted).toBe(true)
    load.resolve(responseFixture([candidateFixture()]))
    await act(async () => {
      await openPromise
    })
    expect(result.current.state).toMatchObject({
      isOpen: false,
      status: 'idle',
      candidates: [],
    })
  })

  it('selects explicitly, initializes an enabled suggestion, and preserves review state on Back', async () => {
    const candidate = candidateFixture({
      candidateKey: 'selected-key',
      suggestedRelationTypeCode: 'remixOf',
    })
    const loadCandidates = vi
      .fn<OriginalCandidateLoader>()
      .mockResolvedValue(responseFixture([candidate]))
    const { result } = renderDiscovery(loadCandidates)
    await act(async () => {
      await result.current.open('source-track')
    })

    act(() => {
      expect(result.current.selectCandidate('selected-key')).toBe(true)
    })
    act(() => {
      result.current.setRelationTypeCode('versionOf')
      result.current.setExpandedEvidenceKeys(['selected-key:supporting'])
      result.current.setCandidateScrollOffset(172)
    })
    act(() => {
      expect(result.current.continueToReview()).toBe(true)
    })
    expect(result.current.state).toMatchObject({
      step: 'review',
      selectedCandidateKey: 'selected-key',
      relationTypeCode: 'versionOf',
      expandedEvidenceKeys: ['selected-key:supporting'],
      candidateScrollOffset: 172,
    })

    act(() => {
      expect(result.current.backToCandidates()).toBe(true)
    })
    expect(result.current.state).toMatchObject({
      step: 'candidates',
      selectedCandidateKey: 'selected-key',
      relationTypeCode: 'versionOf',
      expandedEvidenceKeys: ['selected-key:supporting'],
      candidateScrollOffset: 172,
    })
  })

  it('does not select Low candidates or disabled suggestions', async () => {
    const low = candidateFixture({
      candidateKey: 'low-key',
      confidence: 'low',
      selectable: false,
    })
    const selectable = candidateFixture({
      candidateKey: 'selectable-key',
      suggestedRelationTypeCode: 'disabledType',
    })
    const loadCandidates = vi
      .fn<OriginalCandidateLoader>()
      .mockResolvedValue(responseFixture([low, selectable], false))
    const { result } = renderDiscovery(loadCandidates)
    await act(async () => {
      await result.current.open('source-track')
    })

    act(() => {
      expect(result.current.selectCandidate('low-key')).toBe(false)
      expect(result.current.selectCandidate('missing-key')).toBe(false)
      expect(result.current.selectCandidate('selectable-key')).toBe(true)
    })

    expect(result.current.state.selectedCandidateKey).toBe('selectable-key')
    expect(result.current.state.relationTypeCode).toBeNull()
  })

  it('blocks confirmation when the selected relation type becomes disabled', async () => {
    const candidate = candidateFixture({ candidateKey: 'selected-key' })
    const loadCandidates = vi
      .fn<OriginalCandidateLoader>()
      .mockResolvedValue(responseFixture([candidate]))
    const confirmStackRelation = vi.fn<OriginalCandidateConfirmation>()
    const { result, rerender } = renderHook(
      ({ options }) =>
        useOriginalTrackDiscovery({
          relationTypeOptions: options,
          loadCandidates,
          confirmStackRelation,
        }),
      { initialProps: { options: relationTypeOptions } },
    )
    await act(async () => {
      await result.current.open('source-track')
    })
    act(() => {
      result.current.selectCandidate('selected-key')
    })
    act(() => {
      result.current.continueToReview()
    })

    rerender({ options: relationTypeOptions.slice(1) })
    await act(async () => {
      await expect(result.current.confirmLocal()).resolves.toBe(false)
    })
    expect(confirmStackRelation).not.toHaveBeenCalled()
  })

  it('blocks duplicate confirmation, Back, and close while pending', async () => {
    const confirmation = deferred<void>()
    const confirmStackRelation = vi
      .fn<OriginalCandidateConfirmation>()
      .mockReturnValue(confirmation.promise)
    const onConfirmed = vi.fn()
    const candidate = candidateFixture({
      candidateKey: 'provider-key',
      localTrackId: 'local-target',
      requiresPromotion: true,
    })
    const { result } = renderDiscovery(
      vi
        .fn<OriginalCandidateLoader>()
        .mockResolvedValue(responseFixture([candidate])),
      confirmStackRelation,
      onConfirmed,
    )
    await act(async () => {
      await result.current.open('source-track')
    })
    act(() => {
      result.current.selectCandidate('provider-key')
    })
    act(() => {
      result.current.continueToReview()
    })

    let firstSubmit!: Promise<boolean>
    let duplicateSubmit!: Promise<boolean>
    act(() => {
      firstSubmit = result.current.confirmLocal()
      duplicateSubmit = result.current.confirmLocal()
    })
    await expect(duplicateSubmit).resolves.toBe(false)
    expect(confirmStackRelation).toHaveBeenCalledTimes(1)
    expect(confirmStackRelation).toHaveBeenCalledWith({
      sourceTrackId: 'source-track',
      targetRootTrackId: 'local-target',
      relationTypeCode: 'remixOf',
      markTargetAsOriginal: true,
    })
    act(() => {
      expect(result.current.backToCandidates()).toBe(false)
      expect(result.current.close()).toBe(false)
    })
    expect(result.current.state).toMatchObject({
      isOpen: true,
      step: 'review',
      submitting: true,
    })

    confirmation.resolve()
    await act(async () => {
      await expect(firstSubmit).resolves.toBe(true)
    })
    expect(onConfirmed).toHaveBeenCalledWith({
      candidate,
      relationTypeCode: 'remixOf',
    })
    expect(result.current.state).toMatchObject({
      isOpen: false,
      status: 'idle',
      submitting: false,
    })
  })

  it('returns failed confirmation to review with reviewed values intact', async () => {
    const confirmStackRelation = vi
      .fn<OriginalCandidateConfirmation>()
      .mockRejectedValue(new Error('Confirmation failed'))
    const { result } = renderDiscovery(
      vi
        .fn<OriginalCandidateLoader>()
        .mockResolvedValue(
          responseFixture([
            candidateFixture({ candidateKey: 'selected-key' }),
          ]),
        ),
      confirmStackRelation,
    )
    await act(async () => {
      await result.current.open('source-track')
    })
    act(() => {
      result.current.selectCandidate('selected-key')
    })
    act(() => {
      result.current.setRelationTypeCode('versionOf')
      result.current.setExpandedEvidenceKeys(['selected-key:missing'])
      result.current.setCandidateScrollOffset(91)
    })
    act(() => {
      result.current.continueToReview()
    })

    await act(async () => {
      await expect(result.current.confirmLocal()).resolves.toBe(false)
    })

    expect(result.current.state).toMatchObject({
      isOpen: true,
      step: 'review',
      selectedCandidateKey: 'selected-key',
      relationTypeCode: 'versionOf',
      expandedEvidenceKeys: ['selected-key:missing'],
      candidateScrollOffset: 91,
      submitting: false,
      mutationError: 'Confirmation failed',
    })
  })
})

function renderDiscovery(
  loadCandidates: OriginalCandidateLoader,
  confirmStackRelation: OriginalCandidateConfirmation = vi
    .fn<OriginalCandidateConfirmation>()
    .mockResolvedValue(),
  onConfirmed = vi.fn(),
) {
  return renderHook(() =>
    useOriginalTrackDiscovery({
      relationTypeOptions,
      loadCandidates,
      confirmStackRelation,
      onConfirmed,
    }),
  )
}

function candidateFixture(
  overrides: Partial<LocalOriginalCandidateDto> = {},
): LocalOriginalCandidateDto {
  return {
    candidateKey: 'candidate-key',
    localTrackId: 'local-track',
    title: 'Pulse',
    artistDisplay: 'Candidate Artist',
    durationSeconds: 300,
    versionYear: 1982,
    origins: ['local'],
    confidence: 'high',
    selectable: true,
    isExistingRoot: true,
    memberCount: 1,
    requiresPromotion: false,
    suggestedRelationTypeCode: 'remixOf',
    earliestKnownDate: {
      value: '1982',
      precision: 'year',
      complete: true,
    },
    supportingEvidence: [],
    contradictions: [],
    missingEvidence: [],
    ...overrides,
  }
}

function responseFixture(
  items: LocalOriginalCandidateDto[],
  hasReliableLocalCandidate = items.filter(
    (candidate) => candidate.confidence === 'high',
  ).length === 1,
): LocalOriginalCandidateListDto {
  return {
    sourceTrackId: 'source-track',
    hasReliableLocalCandidate,
    items,
  }
}

async function catalogError(status: number, code: string) {
  return CatalogApiError.fromResponse(
    new Response(JSON.stringify({ code, message: `Failure ${status}` }), {
      headers: { 'Content-Type': 'application/json' },
      status,
    }),
  )
}

type Deferred<Value> = Readonly<{
  promise: Promise<Value>
  resolve: (value: Value) => void
  reject: (reason: unknown) => void
}>

function deferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}
