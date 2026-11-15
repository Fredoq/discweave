import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReleaseCoverPanel } from './ReleaseDetail'
const release = {
  id: 'release-1',
  title: 'Album',
  coverImage: {
    url: '/api/owned?v=one',
    sourceType: 'coverArtArchive',
    contentType: 'image/jpeg',
    sizeBytes: 42,
    originalFileName: 'front.jpg',
  },
}
const json = (sourceUrl: string) =>
  new Response(JSON.stringify({ provenance: { sourceUrl } }), {
    headers: { 'Content-Type': 'application/json' },
  })
afterEach(() => vi.unstubAllGlobals())
describe('release cover attribution', () => {
  it('links the saved source without replacing its app-owned cover', async () => {
    const fetch = vi
      .fn<Window['fetch']>()
      .mockResolvedValue(json('https://coverartarchive.org/release/exact'))
    vi.stubGlobal('fetch', fetch)
    render(<ReleaseCoverPanel release={release} />)
    expect(
      await screen.findByRole('link', { name: 'Cover Art Archive' }),
    ).toHaveAttribute('href', 'https://coverartarchive.org/release/exact')
    expect(screen.getByRole('img', { name: 'Album cover' })).toHaveAttribute(
      'src',
      release.coverImage.url,
    )
    expect(
      screen.getByText(/copyright remains with the rights holders/),
    ).toBeVisible()
    expect(fetch).toHaveBeenCalledWith(
      '/api/releases/release-1/cover-image/provenance',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    )
  })
  it('keeps the managed image visible when attribution cannot load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<Window['fetch']>().mockRejectedValue(new Error('Offline')),
    )
    render(<ReleaseCoverPanel release={release} />)
    expect(
      await screen.findByText(/Source details are currently unavailable/),
    ).toBeVisible()
    expect(screen.getByRole('img', { name: 'Album cover' })).toHaveAttribute(
      'src',
      release.coverImage.url,
    )
  })
  it('does not request attribution for local covers or missing covers', () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const view = render(
      <ReleaseCoverPanel
        release={{
          ...release,
          coverImage: { ...release.coverImage, sourceType: 'localUpload' },
        }}
      />,
    )
    expect(screen.getByRole('img', { name: 'Album cover' })).toBeVisible()
    view.rerender(
      <ReleaseCoverPanel release={{ ...release, coverImage: undefined }} />,
    )
    expect(fetch).not.toHaveBeenCalled()
  })
  it('aborts and ignores old attribution when cover URL or release changes', async () => {
    let finish!: (response: Response) => void
    const pending = new Promise<Response>((resolve) => {
      finish = resolve
    })
    const fetch = vi
      .fn<Window['fetch']>()
      .mockReturnValueOnce(pending)
      .mockResolvedValueOnce(json('https://coverartarchive.org/release/new'))
      .mockResolvedValueOnce(json('https://coverartarchive.org/release/other'))
    vi.stubGlobal('fetch', fetch)
    const view = render(<ReleaseCoverPanel release={release} />)
    view.rerender(
      <ReleaseCoverPanel
        release={{
          ...release,
          coverImage: { ...release.coverImage, url: '/api/owned?v=two' },
        }}
      />,
    )
    expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true)
    expect(
      await screen.findByRole('link', { name: 'Cover Art Archive' }),
    ).toHaveAttribute('href', 'https://coverartarchive.org/release/new')
    await act(async () => {
      finish(json('https://coverartarchive.org/release/stale'))
      await pending
    })
    expect(
      screen.getByRole('link', { name: 'Cover Art Archive' }),
    ).toHaveAttribute('href', 'https://coverartarchive.org/release/new')
    view.rerender(<ReleaseCoverPanel release={{ ...release, id: 'other' }} />)
    expect(
      await screen.findByRole('link', { name: 'Cover Art Archive' }),
    ).toHaveAttribute('href', 'https://coverartarchive.org/release/other')
  })
})
