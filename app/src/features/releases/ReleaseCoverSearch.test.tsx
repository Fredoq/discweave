import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReleaseCoverPanel } from './ReleaseCoverPanel'
const old = {
  url: '/api/owned?v=old',
  contentType: 'image/jpeg',
  originalFileName: 'old.jpg',
  sizeBytes: 12,
  sourceType: 'localUpload',
}
const updated = {
  ...old,
  url: '/api/owned?v=new',
  sourceType: 'coverArtArchive',
}
const release = {
  id: 'local/a',
  title: 'My album',
  artist: 'Artist',
  labels: [{ name: 'Label', catalogNumber: 'CAT1', hasNoCatalogNumber: false }],
  coverImage: old,
}
const edition = {
  releaseId: 'mb-edition',
  title: 'Edition',
  artists: ['Artist'],
  date: '1999',
  country: 'GB',
  formats: ['CD'],
  labels: ['Label'],
  catalogNumbers: ['CAT1'],
  barcode: null,
  sourceUrl: 'https://musicbrainz.org/release/mb-edition',
}
const image = {
  imageId: '123',
  comment: 'Front',
  approved: true,
  types: ['Front'],
  sourceUrl: 'https://coverartarchive.org/release/mb-edition/123.jpg',
}
const json = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  })
function deferred() {
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>((finish) => {
    resolve = finish
  })
  return { resolve, promise }
}
async function chooseEdition() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Find cover' }))
  await user.click(screen.getByRole('button', { name: 'Search editions' }))
  await user.click(
    await screen.findByRole('button', { name: 'Show covers for Edition' }),
  )
  await screen.findByRole('button', { name: 'Use this cover' })
  return user
}
afterEach(() => vi.unstubAllGlobals())
describe('existing release cover search', () => {
  it('browses without writing, applies explicitly, locks mutations and refreshes versioned attribution', async () => {
    const save = deferred()
    const fetch = vi
      .fn<Window['fetch']>()
      .mockResolvedValueOnce(json({ items: [edition] }))
      .mockResolvedValueOnce(json({ items: [image] }))
      .mockReturnValueOnce(save.promise)
      .mockResolvedValueOnce(
        json({ provenance: { sourceUrl: image.sourceUrl } }),
      )
    vi.stubGlobal('fetch', fetch)
    const onCoverSaved = vi.fn(),
      onUploadCover = vi.fn(),
      onRemoveCover = vi.fn()
    render(
      <ReleaseCoverPanel
        release={release}
        onCoverSaved={onCoverSaved}
        onUploadCover={onUploadCover}
        onRemoveCover={onRemoveCover}
      />,
    )
    const user = await chooseEdition()
    expect(screen.getByLabelText('Artist')).toHaveValue('Artist')
    expect(screen.getByLabelText('Catalog number')).toHaveValue('CAT1')
    expect(fetch.mock.calls[0][0]).toContain(
      '/api/releases/local%2Fa/cover-artwork/search?',
    )
    expect(fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(
      true,
    )
    expect(
      screen.getByRole('img', { name: 'Front cover for Edition' }),
    ).toHaveAttribute(
      'src',
      '/api/releases/local%2Fa/cover-artwork/releases/mb-edition/images/123',
    )
    await user.click(screen.getByRole('button', { name: 'Use this cover' }))
    expect(screen.getByText('Applying cover...')).toBeVisible()
    expect(screen.getByRole('img', { name: 'My album cover' })).toHaveAttribute(
      'src',
      old.url,
    )
    for (const name of [
      'Find cover',
      'Remove cover',
      'Cancel search',
      'Use this cover',
    ])
      expect(screen.getByRole('button', { name })).toBeDisabled()
    expect(screen.getByLabelText('Replace cover')).toBeDisabled()
    expect(fetch.mock.calls[2][0]).toBe(
      '/api/releases/local%2Fa/cover-artwork/external-selection',
    )
    expect(fetch.mock.calls[2][1]?.body).toBe(
      JSON.stringify({ releaseId: 'mb-edition', imageId: '123' }),
    )
    await act(async () => {
      save.resolve(json(updated))
      await save.promise
    })
    await waitFor(() =>
      expect(onCoverSaved).toHaveBeenCalledWith('local/a', updated),
    )
    expect(screen.getByRole('img', { name: 'My album cover' })).toHaveAttribute(
      'src',
      updated.url,
    )
    expect(
      await screen.findByRole('link', { name: 'Cover Art Archive' }),
    ).toHaveAttribute('href', image.sourceUrl)
    expect(fetch.mock.calls[3][0]).toBe(
      '/api/releases/local%2Fa/cover-image/provenance',
    )
    expect(onUploadCover).not.toHaveBeenCalled()
    expect(onRemoveCover).not.toHaveBeenCalled()
  })
  it('keeps old cover after apply failure and clears results on cancel/reopen', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<Window['fetch']>()
        .mockResolvedValueOnce(json({ items: [edition] }))
        .mockResolvedValueOnce(json({ items: [image] }))
        .mockRejectedValueOnce(new Error('Download failed')),
    )
    const onCoverSaved = vi.fn()
    render(<ReleaseCoverPanel release={release} onCoverSaved={onCoverSaved} />)
    const user = await chooseEdition()
    await user.click(screen.getByRole('button', { name: 'Use this cover' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Download failed',
    )
    expect(screen.getByRole('img', { name: 'My album cover' })).toHaveAttribute(
      'src',
      old.url,
    )
    await user.click(screen.getByRole('button', { name: 'Cancel search' }))
    await user.click(screen.getByRole('button', { name: 'Find cover' }))
    expect(
      screen.queryByRole('button', { name: 'Use this cover' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onCoverSaved).not.toHaveBeenCalled()
  })
  it('aborts browsing on cancel and ignores the response after reopen', async () => {
    const search = deferred()
    const fetch = vi.fn<Window['fetch']>().mockReturnValueOnce(search.promise)
    vi.stubGlobal('fetch', fetch)
    render(<ReleaseCoverPanel release={release} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Find cover' }))
    await user.click(screen.getByRole('button', { name: 'Search editions' }))
    await user.click(screen.getByRole('button', { name: 'Cancel search' }))
    expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Find cover' }))
    await act(async () => {
      search.resolve(json({ items: [edition] }))
      await search.promise
    })
    expect(
      screen.queryByRole('button', { name: 'Show covers for Edition' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'My album cover' })).toHaveAttribute(
      'src',
      old.url,
    )
  })
  it('resets browsing on navigation and ignores an old request', async () => {
    const search = deferred()
    const fetch = vi.fn<Window['fetch']>().mockReturnValueOnce(search.promise)
    vi.stubGlobal('fetch', fetch)
    const view = render(<ReleaseCoverPanel release={release} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Find cover' }))
    await user.click(screen.getByRole('button', { name: 'Search editions' }))
    view.rerender(
      <ReleaseCoverPanel
        release={{ ...release, id: 'second', title: 'Second' }}
      />,
    )
    expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true)
    await act(async () => {
      search.resolve(json({ items: [edition] }))
      await search.promise
    })
    expect(
      screen.queryByRole('region', { name: 'Find cover' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Find cover' }))
    expect(screen.getByLabelText('Release title')).toHaveValue('Second')
    expect(
      screen.queryByText('Show covers for Edition'),
    ).not.toBeInTheDocument()
  })
  it('ignores an old apply after navigation and displays canonical cover on returning', async () => {
    const save = deferred()
    vi.stubGlobal(
      'fetch',
      vi
        .fn<Window['fetch']>()
        .mockResolvedValueOnce(json({ items: [edition] }))
        .mockResolvedValueOnce(json({ items: [image] }))
        .mockReturnValueOnce(save.promise)
        .mockResolvedValueOnce(json({ provenance: null })),
    )
    const onCoverSaved = vi.fn()
    const view = render(
      <ReleaseCoverPanel release={release} onCoverSaved={onCoverSaved} />,
    )
    const user = await chooseEdition()
    await user.click(screen.getByRole('button', { name: 'Use this cover' }))
    view.rerender(
      <ReleaseCoverPanel
        release={{ ...release, id: 'second', title: 'Second' }}
        onCoverSaved={onCoverSaved}
      />,
    )
    await act(async () => {
      save.resolve(json(updated))
      await save.promise
    })
    expect(screen.getByRole('img', { name: 'Second cover' })).toHaveAttribute(
      'src',
      old.url,
    )
    expect(onCoverSaved).toHaveBeenCalledWith(release.id, updated)
    expect(onCoverSaved).toHaveBeenCalledTimes(1)
    view.rerender(
      <ReleaseCoverPanel
        release={{ ...release, coverImage: updated }}
        onCoverSaved={onCoverSaved}
      />,
    )
    expect(screen.getByRole('img', { name: 'My album cover' })).toHaveAttribute(
      'src',
      updated.url,
    )
  })
  it('retains cover and exposes actionable errors when release lookup is inaccessible', async () => {
    const fetch = vi
      .fn<Window['fetch']>()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
    vi.stubGlobal('fetch', fetch)
    render(<ReleaseCoverPanel release={release} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Find cover' }))
    await user.click(screen.getByRole('button', { name: 'Search editions' }))
    expect(await screen.findByRole('alert')).toBeVisible()
    expect(screen.getByRole('img', { name: 'My album cover' })).toHaveAttribute(
      'src',
      old.url,
    )
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
