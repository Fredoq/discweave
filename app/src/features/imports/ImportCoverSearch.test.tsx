import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ImportCoverPicker } from './ImportCoverPicker'
const oldCover = {
  id: 'local',
  fileName: 'old.png',
  contentType: 'image/png',
  sizeBytes: 50,
  url: '/api/old',
  sourcePath: '/music/old.png',
}
const artwork = {
  selected: oldCover,
  candidates: [],
  canEdit: true,
  warnings: [],
}
const edition = {
  releaseId: 'exact-edition',
  title: 'Album',
  artists: ['Artist'],
  date: '1999',
  country: 'GB',
  formats: ['CD'],
  labels: ['Label'],
  catalogNumbers: ['CAT-1'],
  barcode: '123456',
  sourceUrl: 'https://musicbrainz.org/release/exact-edition',
}
const candidate = {
  imageId: '42',
  comment: 'Front sleeve',
  approved: true,
  types: ['Front'],
  sourceUrl: 'https://coverartarchive.org/release/exact-edition/42.jpg',
}
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const props = () => ({
  sessionId: 'session',
  draftId: 'draft',
  disabled: false,
  searchSeed: { artist: 'Artist', title: 'Album', catalogNumber: 'CAT-1' },
  onSelection: vi.fn(),
  onPendingChange: vi.fn(),
})
afterEach(() => vi.unstubAllGlobals())
async function openSearch() {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Find cover' }))
  return user
}
describe('external import covers', () => {
  it('uses the shared labeled controls without changing accessible action names', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<Window['fetch']>().mockResolvedValueOnce(json(artwork)),
    )
    render(<ImportCoverPicker {...props()} />)
    await openSearch()
    const search = screen.getByRole('region', { name: 'Find cover' })
    for (const name of [
      'Artist',
      'Release title',
      'Catalog number',
      'Barcode',
    ]) {
      const field = within(search).getByRole('textbox', { name })
      expect(field.closest('label')).toHaveClass('settings-control')
      expect(field).toBeEnabled()
    }
    expect(
      within(search).getByRole('button', { name: 'Search editions' }),
    ).toHaveClass('button-secondary', 'button-compact')
    expect(screen.getByLabelText('Upload cover image')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Find cover' })).toBeEnabled()
  })
  it('searches metadata, requires an exact edition and explicit cover selection, then keeps an owned copy', async () => {
    const fetch = vi
      .fn<Window['fetch']>()
      .mockResolvedValueOnce(json(artwork))
      .mockResolvedValueOnce(json({ items: [edition] }))
      .mockResolvedValueOnce(json({ items: [candidate] }))
      .mockResolvedValueOnce(
        json({
          ...artwork,
          selected: {
            ...oldCover,
            id: null,
            fileName: 'external.jpg',
            url: '/api/owned',
            sourcePath: null,
          },
        }),
      )
    vi.stubGlobal('fetch', fetch)
    const callbacks = props()
    render(<ImportCoverPicker {...callbacks} />)
    const user = await openSearch()
    const search = screen.getByRole('region', { name: 'Find cover' })
    expect(within(search).getByLabelText('Artist')).toHaveValue('Artist')
    expect(within(search).getByLabelText('Catalog number')).toHaveValue('CAT-1')
    await user.click(
      within(search).getByRole('button', { name: 'Search editions' }),
    )
    await user.click(
      await screen.findByRole('button', { name: 'Show covers for Album' }),
    )
    expect(
      await screen.findByRole('img', { name: 'Front cover for Album' }),
    ).toHaveAttribute(
      'src',
      '/api/imports/session/drafts/draft/cover-artwork/releases/exact-edition/images/42',
    )
    expect(
      screen.getByText(/Approval is not a copyright license/),
    ).toBeVisible()
    expect(
      screen.getByText(/Image copyright remains with the rights holders/),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'View image source' }),
    ).toHaveAttribute('href', candidate.sourceUrl)
    expect(screen.getByRole('link', { name: 'View image source' })).toHaveClass(
      'detail-link',
    )
    expect(
      screen.getByRole('link', { name: 'View edition on MusicBrainz' }),
    ).toHaveClass('detail-link')
    expect(callbacks.onSelection).not.toHaveBeenCalled()
    expect(fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(
      true,
    )
    expect(fetch.mock.calls[1][0]).toContain(
      'artist=Artist&title=Album&catalogNumber=CAT-1',
    )
    expect(fetch.mock.calls[1][0]).not.toContain('music')
    await user.click(screen.getByRole('button', { name: 'Use this cover' }))
    await waitFor(() =>
      expect(callbacks.onSelection).toHaveBeenCalledWith(null),
    )
    expect(fetch.mock.calls[3][1]?.body).toBe(
      JSON.stringify({ releaseId: 'exact-edition', imageId: '42' }),
    )
    expect(screen.getByRole('img', { name: 'Selected cover' })).toHaveAttribute(
      'src',
      '/api/owned',
    )
  })
  it('retains the previous cover after search failure, retry, apply failure and cancel', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<Window['fetch']>()
        .mockResolvedValueOnce(json(artwork))
        .mockRejectedValueOnce(new Error('Offline'))
        .mockResolvedValueOnce(json({ items: [edition] }))
        .mockResolvedValueOnce(json({ items: [candidate] }))
        .mockRejectedValueOnce(new Error('Download failed')),
    )
    const callbacks = props()
    render(<ImportCoverPicker {...callbacks} />)
    const user = await openSearch()
    await user.click(screen.getByRole('button', { name: 'Search editions' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
    await user.click(screen.getByRole('button', { name: 'Search editions' }))
    await user.click(
      await screen.findByRole('button', { name: 'Show covers for Album' }),
    )
    await user.click(
      await screen.findByRole('button', { name: 'Use this cover' }),
    )
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Download failed'),
    )
    await user.click(screen.getByRole('button', { name: 'Cancel search' }))
    expect(
      screen.queryByRole('region', { name: 'Find cover' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Selected cover' })).toHaveAttribute(
      'src',
      '/api/old',
    )
    expect(callbacks.onSelection).not.toHaveBeenCalled()
  })
  it('ignores stale search after switching drafts and never falls back to another edition', async () => {
    let finish!: (value: Response) => void
    const pending = new Promise<Response>((resolve) => {
      finish = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi
        .fn<Window['fetch']>()
        .mockResolvedValueOnce(json(artwork))
        .mockReturnValueOnce(pending)
        .mockResolvedValueOnce(json(artwork))
        .mockResolvedValueOnce(json({ items: [edition] }))
        .mockResolvedValueOnce(json({ items: [] })),
    )
    const callbacks = props()
    const view = render(<ImportCoverPicker {...callbacks} />)
    const user = await openSearch()
    await user.click(screen.getByRole('button', { name: 'Search editions' }))
    view.rerender(<ImportCoverPicker {...callbacks} draftId="second" />)
    await act(async () => {
      finish(json({ items: [edition] }))
      await pending
    })
    expect(screen.queryByText('Show covers for Album')).not.toBeInTheDocument()
    await openSearch()
    await user.click(screen.getByRole('button', { name: 'Search editions' }))
    await user.click(
      await screen.findByRole('button', { name: 'Show covers for Album' }),
    )
    expect(
      await screen.findByText(/No front cover for this exact edition/),
    ).toBeVisible()
    expect(callbacks.onSelection).not.toHaveBeenCalled()
  })
  it('sends only edited query metadata, not local paths, when browsing', async () => {
    const fetch = vi
      .fn<Window['fetch']>()
      .mockResolvedValueOnce(json(artwork))
      .mockResolvedValueOnce(json({ items: [] }))
    vi.stubGlobal('fetch', fetch)
    render(<ImportCoverPicker {...props()} />)
    const user = await openSearch()
    fireEvent.change(screen.getByLabelText('Barcode'), {
      target: { value: '987' },
    })
    await user.click(screen.getByRole('button', { name: 'Search editions' }))
    await screen.findByText(/No matching editions/)
    expect(fetch.mock.calls[1][0]).toContain('barcode=987')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('cancels in-flight browsing without changing the selected cover', async () => {
    let finish!: (value: Response) => void
    const pending = new Promise<Response>((resolve) => {
      finish = resolve
    })
    const fetch = vi
      .fn<Window['fetch']>()
      .mockResolvedValueOnce(json(artwork))
      .mockReturnValueOnce(pending)
    vi.stubGlobal('fetch', fetch)
    const callbacks = props()
    render(<ImportCoverPicker {...callbacks} />)
    const user = await openSearch()
    await user.click(screen.getByRole('button', { name: 'Search editions' }))
    const signal = fetch.mock.calls[1][1]?.signal
    await user.click(screen.getByRole('button', { name: 'Cancel search' }))
    expect(signal?.aborted).toBe(true)
    await act(async () => {
      finish(json({ items: [edition] }))
      await pending
    })
    expect(
      screen.queryByRole('region', { name: 'Find cover' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Selected cover' })).toHaveAttribute(
      'src',
      '/api/old',
    )
    expect(callbacks.onSelection).not.toHaveBeenCalled()
  })
})
