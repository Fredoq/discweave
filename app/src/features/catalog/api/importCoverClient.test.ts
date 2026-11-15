import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  loadImportCoverArtwork,
  selectImportCoverArtwork,
  uploadImportCoverArtwork,
} from './importCoverClient'
const artwork = { selected: null, candidates: [], canEdit: true, warnings: [] }
const response = (body: unknown = artwork, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
afterEach(() => vi.unstubAllGlobals())
describe('import cover transport', () => {
  it('loads with session credentials, cancellation and no cached selection', async () => {
    const fetch = vi.fn<Window['fetch']>().mockResolvedValue(response())
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()
    await loadImportCoverArtwork('session', 'draft', controller.signal)
    expect(fetch).toHaveBeenCalledWith(
      '/api/imports/session/drafts/draft/cover-artwork',
      {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      },
    )
  })
  it('does not silently turn inaccessible drafts into empty cover candidates', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<Window['fetch']>()
        .mockResolvedValue(response({ error: 'Not found' }, 404)),
    )
    await expect(loadImportCoverArtwork('session', 'foreign')).rejects.toThrow()
  })
  it('sends explicit null to clear the cover rather than omitting it', async () => {
    const fetch = vi.fn<Window['fetch']>().mockResolvedValue(response())
    vi.stubGlobal('fetch', fetch)
    await selectImportCoverArtwork('session', 'draft', null)
    expect(fetch.mock.calls[0][1]?.body).toBe(
      JSON.stringify({ candidateId: null }),
    )
  })
  it('rejects invalid image uploads before sending bytes', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    for (const file of [
      new File([], 'a.png', { type: 'image/png' }),
      new File(['x'], 'a.svg', { type: 'image/svg+xml' }),
      new File(['x'], 'a.png', { type: 'image/jpeg' }),
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'a.png', {
        type: 'image/png',
      }),
    ]) {
      await expect(
        uploadImportCoverArtwork('session', 'draft', file),
      ).rejects.toThrow()
    }
    expect(fetch).not.toHaveBeenCalled()
  })
  it('rejects unexpected collection identifiers in cover responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<Window['fetch']>()
        .mockResolvedValue(response({ ...artwork, collectionId: 'foreign' })),
    )
    await expect(loadImportCoverArtwork('session', 'draft')).rejects.toThrow()
  })
})
