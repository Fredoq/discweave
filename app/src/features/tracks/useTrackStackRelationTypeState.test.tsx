import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as h from '../../test/appTestHarness'
import { defaultTrackStackRelationTypeCodes } from './trackStackModel'
import { useTrackStackRelationTypeState } from './useTrackStackRelationTypeState'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useTrackStackRelationTypeState', () => {
  it('returns explicit product defaults immediately for the local catalog', () => {
    const { result } = renderHook(() => useTrackStackRelationTypeState(false))

    expect(result.current).toEqual({
      codes: defaultTrackStackRelationTypeCodes,
      status: 'ready',
    })
  })

  it('does not expose optimistic server defaults and preserves a real empty response', async () => {
    const response = deferred<Response>()
    vi.stubGlobal(
      'fetch',
      vi.fn<Window['fetch']>(() => response.promise),
    )
    const { result } = renderHook(() => useTrackStackRelationTypeState(true))

    expect(result.current).toEqual({ codes: [], status: 'loading' })

    await act(async () => {
      response.resolve(h.jsonResponse({ defaultRelationTypeCodes: [] }))
      await response.promise
    })
    await waitFor(() => {
      expect(result.current).toEqual({ codes: [], status: 'ready' })
    })
  })

  it('keeps the server action disabled after a settings failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<Window['fetch']>().mockRejectedValue(new Error('offline')),
    )
    const { result } = renderHook(() => useTrackStackRelationTypeState(true))

    await waitFor(() => {
      expect(result.current).toEqual({ codes: [], status: 'error' })
    })
  })

  it('accepts the legacy settings response without optimistic fallback', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<Window['fetch']>()
        .mockResolvedValue(h.jsonResponse({ relationTypeCodes: ['remixOf'] })),
    )
    const { result } = renderHook(() => useTrackStackRelationTypeState(true))

    expect(result.current).toEqual({ codes: [], status: 'loading' })
    await waitFor(() => {
      expect(result.current).toEqual({
        codes: ['remixOf'],
        status: 'ready',
      })
    })
  })
})

type Deferred<Value> = Readonly<{
  promise: Promise<Value>
  resolve: (value: Value) => void
}>

function deferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}
