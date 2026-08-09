import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type {
  LocalOriginalCandidateDto,
  LocalOriginalCandidateListDto,
} from '../catalog/api/catalogDtoTypes'
import {
  useOriginalTrackDiscovery,
  type OriginalCandidateConfirmation,
  type OriginalCandidateLoader,
} from './useOriginalTrackDiscovery'

const relationTypeOptions = [{ code: 'remixOf', label: 'Remix of' }]

describe('useOriginalTrackDiscovery confirmation lifecycle', () => {
  it('aborts an active local request when the hook unmounts', async () => {
    const local = deferred<LocalOriginalCandidateListDto>()
    const loadCandidates = vi
      .fn<OriginalCandidateLoader>()
      .mockReturnValue(local.promise)
    const { result, unmount } = renderHook(() =>
      useOriginalTrackDiscovery({
        relationTypeOptions,
        loadCandidates,
      }),
    )

    await act(async () => {
      await Promise.resolve(result.current.open('source-track'))
    })
    const signal = loadCandidates.mock.calls[0][1].signal
    unmount()

    expect(signal.aborted).toBe(true)
    local.resolve(responseFixture())
  })

  it.each(['resolve', 'reject'] as const)(
    'ignores %s settlement after the hook unmounts',
    async (settlement) => {
      const confirmation = deferred<void>()
      const confirmStackRelation = vi
        .fn<OriginalCandidateConfirmation>()
        .mockReturnValue(confirmation.promise)
      const onConfirmed = vi.fn()
      const loadCandidates = vi
        .fn<OriginalCandidateLoader>()
        .mockResolvedValue(responseFixture())
      const { result, unmount } = renderHook(() =>
        useOriginalTrackDiscovery({
          relationTypeOptions,
          loadCandidates,
          confirmStackRelation,
          onConfirmed,
        }),
      )
      await act(async () => {
        await result.current.open('source-track')
      })
      act(() => {
        result.current.selectCandidate('candidate-key')
      })
      act(() => {
        result.current.continueToReview()
      })

      let submission!: Promise<boolean>
      act(() => {
        submission = result.current.confirmLocal()
      })
      expect(result.current.state.submitting).toBe(true)
      unmount()

      let messageReads = 0
      const rejection = new Error()
      Object.defineProperty(rejection, 'message', {
        configurable: true,
        get: () => {
          messageReads += 1
          return 'Confirmation failed'
        },
      })
      if (settlement === 'resolve') {
        confirmation.resolve()
      } else {
        confirmation.reject(rejection)
      }
      await expect(submission).resolves.toBe(false)

      expect(onConfirmed).not.toHaveBeenCalled()
      expect(messageReads).toBe(0)
      expect(result.current.state.submitting).toBe(true)
    },
  )
})

function responseFixture(): LocalOriginalCandidateListDto {
  return {
    sourceTrackId: 'source-track',
    hasReliableLocalCandidate: true,
    items: [candidateFixture()],
  }
}

function candidateFixture(): LocalOriginalCandidateDto {
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
  }
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
