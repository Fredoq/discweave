import { afterEach, describe, expect, it, vi } from 'vitest'
import { labelDiscogsApi } from './labelDiscogsApi'

afterEach(() => vi.unstubAllGlobals())

describe('Label Discogs transport', () => {
  it('encodes searches and uses authenticated cancellable requests', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ items: [], total: 0 })))
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal
    await labelDiscogsApi.search('label / one', '50 Weapons & more', signal)
    expect(fetch).toHaveBeenCalledWith(
      '/api/labels/label%20%2F%20one/discogs/search?query=50+Weapons+%26+more',
      { credentials: 'include', signal },
    )
  })
  it('saves only explicit selection and prefix preferences', async () => {
    const response = {
      discogsLabelId: '398551',
      discogsLabelName: '50Weapons',
      prefixes: ['50WLP'],
    }
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(response)))
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal
    expect(
      await labelDiscogsApi.save('label', '398551', ['50WLP'], signal),
    ).toEqual(response)
    expect(fetch).toHaveBeenCalledWith(
      '/api/labels/label/discogs/preferences',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        signal,
        body: JSON.stringify({ discogsLabelId: '398551', prefixes: ['50WLP'] }),
      }),
    )
  })
  it('does not turn a missing catalog into a successful empty result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'label.not_found',
            message: 'Label not found',
          }),
          { status: 404 },
        ),
      ),
    )
    await expect(
      labelDiscogsApi.page('label', 2, new AbortController().signal),
    ).rejects.toMatchObject({ status: 404, code: 'label.not_found' })
  })
  it('rejects accidental collection identifiers in responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ collectionId: 'private' })),
        ),
    )
    await expect(
      labelDiscogsApi.preferences('label', new AbortController().signal),
    ).rejects.toThrow('must not expose collection ids')
  })
})
