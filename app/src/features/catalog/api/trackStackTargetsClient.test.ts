import { afterEach, describe, expect, it, vi } from 'vitest'
import * as h from '../../../test/appTestHarness'
import { CatalogApiError } from './httpClient'
import { searchTrackStackTargets } from './trackStackTargetsClient'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('track stack targets client', () => {
  it('encodes the stack target query and forwards the abort signal', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(
        h.jsonResponse({ items: [], limit: 12, offset: 4, total: 0 }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    await searchTrackStackTargets(
      {
        sourceTrackId: 'source-track',
        search: 'Blue Monday & Friends',
        offset: 4,
        limit: 12,
      },
      { signal: controller.signal },
    )

    const [input, init] = fetchMock.mock.calls[0]
    const rawUrl =
      typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : input.toString()
    const url = new URL(rawUrl, window.location.origin)

    expect(rawUrl).toContain('search=Blue+Monday+%26+Friends')
    expect(url.pathname).toBe('/api/tracks/stack-targets')
    expect(url.searchParams.get('sourceTrackId')).toBe('source-track')
    expect(url.searchParams.get('search')).toBe('Blue Monday & Friends')
    expect(url.searchParams.get('offset')).toBe('4')
    expect(url.searchParams.get('limit')).toBe('12')
    expect(init).toMatchObject({
      credentials: 'include',
      method: 'GET',
      signal: controller.signal,
    })
    expect(init?.signal).toBe(controller.signal)
  })

  it('uses offset zero and limit twenty by default', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(
        h.jsonResponse({ items: [], limit: 20, offset: 0, total: 0 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await searchTrackStackTargets({
      sourceTrackId: 'source-track',
      search: 'bass',
    })

    const [input] = fetchMock.mock.calls[0]
    const rawUrl =
      typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : input.toString()
    const url = new URL(rawUrl, window.location.origin)
    expect(url.searchParams.get('offset')).toBe('0')
    expect(url.searchParams.get('limit')).toBe('20')
  })

  it('throws the typed API error for an inaccessible source', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<Window['fetch']>()
        .mockResolvedValue(
          h.jsonResponse(
            { code: 'track.not_found', message: 'Track was not found' },
            404,
          ),
        ),
    )

    const error = await searchTrackStackTargets({
      sourceTrackId: 'missing-track',
      search: 'bass',
    }).catch((value: unknown) => value)

    expect(error).toBeInstanceOf(CatalogApiError)
    expect(error).toMatchObject({
      status: 404,
      code: 'track.not_found',
      message: 'Track was not found',
    })
  })
})
