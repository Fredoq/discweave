import { afterEach, describe, expect, it, vi } from 'vitest'
import * as h from '../../../test/appTestHarness'
import { sendJson } from './httpClient'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('sendJson cancellation', () => {
  it('forwards an optional caller signal without changing the request contract', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(h.jsonResponse({ accepted: true }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    const sendWithOptions = sendJson as typeof sendJson &
      ((
        path: string,
        method: 'POST',
        body: unknown,
        options: Readonly<{ signal?: AbortSignal }>,
      ) => Promise<{ accepted: boolean }>)

    await expect(
      sendWithOptions(
        '/api/example',
        'POST',
        {},
        {
          signal: controller.signal,
        },
      ),
    ).resolves.toEqual({ accepted: true })
    expect(fetchMock).toHaveBeenCalledWith('/api/example', {
      body: '{}',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: controller.signal,
    })
  })

  it('keeps the existing fetch shape when options are omitted', async () => {
    const fetchMock = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(h.jsonResponse({ accepted: true }))
    vi.stubGlobal('fetch', fetchMock)

    await sendJson('/api/example', 'POST', {})

    expect(fetchMock).toHaveBeenCalledWith('/api/example', {
      body: '{}',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
  })
})
