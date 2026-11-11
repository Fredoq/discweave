import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  linkLabelImport,
  loadLabelImports,
  unlinkLabelImport,
} from './labelImportsApi'

afterEach(() => vi.unstubAllGlobals())

describe('Label imports API', () => {
  it('loads every page of explicitly unlinked imports', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [{ id: 'first' }], total: 2 })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [{ id: 'second' }], total: 2 })),
      )
    vi.stubGlobal('fetch', fetchMock)
    expect((await loadLabelImports('label-a', false)).items).toHaveLength(2)
    expect(fetchMock.mock.calls[0][0]).toContain(
      '/api/labels/label-a/imports?linked=false&limit=',
    )
    expect(fetchMock.mock.calls[1][0]).toContain('offset=1')
  })

  it('only creates and removes the association at the label import endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(null, { status: 204 })),
      )
    vi.stubGlobal('fetch', fetchMock)
    await linkLabelImport('label-a', 'session-a')
    await unlinkLabelImport('label-a', 'session-a')
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/labels/label-a/imports/session-a',
      expect.objectContaining({ method: 'PUT', body: '{}' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/labels/label-a/imports/session-a',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})
