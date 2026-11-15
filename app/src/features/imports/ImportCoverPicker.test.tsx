import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ImportCoverPicker } from './ImportCoverPicker'
const front = {
  id: 'front',
  fileName: 'front.png',
  contentType: 'image/png',
  sizeBytes: 1024,
  url: '/api/front',
  sourcePath: '/music/front.png',
}
const back = {
  ...front,
  id: 'back',
  fileName: 'back.jpg',
  contentType: 'image/jpeg',
  url: '/api/back',
  sourcePath: '/music/back.jpg',
}
const initial = {
  selected: front,
  candidates: [front, back],
  canEdit: true,
  warnings: [],
}
const response = (body: unknown = initial) =>
  new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  })
const props = () => ({
  sessionId: 'session',
  draftId: 'draft',
  disabled: false,
  onSelection: vi.fn<(path: string | null) => void>(),
  onPendingChange: vi.fn<(pending: boolean) => void>(),
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((finish) => {
    resolve = finish
  })
  return { resolve, promise }
}
afterEach(() => vi.unstubAllGlobals())
describe('import cover picker', () => {
  it('previews several candidates, dimensions and explicit no-cover selection', async () => {
    const fetch = vi
      .fn<Window['fetch']>()
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response({ ...initial, selected: back }))
      .mockResolvedValueOnce(response({ ...initial, selected: null }))
    vi.stubGlobal('fetch', fetch)
    const callbacks = props()
    render(<ImportCoverPicker {...callbacks} />)
    const user = userEvent.setup()
    const preview = await screen.findByRole('img', { name: 'Selected cover' })
    Object.defineProperties(preview, {
      naturalWidth: { value: 600 },
      naturalHeight: { value: 600 },
    })
    fireEvent.load(preview)
    expect(screen.getByText('600 × 600')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Use front.png as cover' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await user.click(
      screen.getByRole('button', { name: 'Use back.jpg as cover' }),
    )
    await waitFor(() =>
      expect(callbacks.onSelection).toHaveBeenLastCalledWith(back.sourcePath),
    )
    expect(screen.getByRole('img', { name: 'Selected cover' })).toHaveAttribute(
      'src',
      back.url,
    )
    await user.click(screen.getByRole('button', { name: 'No cover' }))
    await waitFor(() =>
      expect(callbacks.onSelection).toHaveBeenLastCalledWith(null),
    )
    expect(screen.getByText('No cover selected.')).toBeVisible()
    expect(fetch.mock.calls[1][1]?.body).toBe(
      JSON.stringify({ candidateId: 'back' }),
    )
    expect(
      callbacks.onPendingChange.mock.calls.map(([pending]) => pending),
    ).toEqual([true, false, true, false])
  })
  it('uploads a local image and ignores file-picker cancellation', async () => {
    const fetch = vi
      .fn<Window['fetch']>()
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(
        response({
          ...initial,
          selected: {
            ...front,
            id: null,
            fileName: 'upload.webp',
            sourcePath: null,
          },
        }),
      )
    vi.stubGlobal('fetch', fetch)
    const callbacks = props()
    render(<ImportCoverPicker {...callbacks} />)
    const user = userEvent.setup()
    await screen.findByRole('img', { name: 'Selected cover' })
    const input = screen.getByLabelText('Upload cover image')
    fireEvent.change(input, { target: { files: [] } })
    expect(fetch).toHaveBeenCalledTimes(1)
    await user.upload(
      input,
      new File(['bytes'], 'upload.webp', { type: 'image/webp' }),
    )
    await waitFor(() =>
      expect(callbacks.onSelection).toHaveBeenCalledWith(null),
    )
    expect(fetch.mock.calls[1][1]?.body).toBeInstanceOf(FormData)
    expect(screen.getByText('upload.webp')).toBeVisible()
    expect(input).toHaveValue('')
  })
  it('preserves the old selection on failure and allows retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<Window['fetch']>()
        .mockResolvedValueOnce(response())
        .mockRejectedValueOnce(new Error('Cannot save cover'))
        .mockResolvedValueOnce(response({ ...initial, selected: back })),
    )
    const callbacks = props()
    render(<ImportCoverPicker {...callbacks} />)
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: 'Use back.jpg as cover' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cannot save cover',
    )
    expect(screen.getByRole('img', { name: 'Selected cover' })).toHaveAttribute(
      'src',
      front.url,
    )
    expect(callbacks.onSelection).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: 'Use back.jpg as cover' }),
    )
    await waitFor(() =>
      expect(callbacks.onSelection).toHaveBeenCalledWith(back.sourcePath),
    )
  })
  it('reloads a saved preview and does not invent previews for names-only scans', async () => {
    const fetch = vi
      .fn<Window['fetch']>()
      .mockResolvedValueOnce(response({ ...initial, selected: back }))
      .mockResolvedValueOnce(
        response({
          selected: null,
          candidates: [],
          canEdit: true,
          warnings: ['Names only'],
        }),
      )
    vi.stubGlobal('fetch', fetch)
    const callbacks = props()
    const view = render(<ImportCoverPicker {...callbacks} />)
    expect(
      await screen.findByRole('img', { name: 'Selected cover' }),
    ).toHaveAttribute('src', back.url)
    view.unmount()
    render(<ImportCoverPicker {...callbacks} />)
    expect(await screen.findByText(/No stored candidates/)).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('Names only')).toBeVisible()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('ignores an obsolete load after switching drafts', async () => {
    const old = deferred<Response>()
    vi.stubGlobal(
      'fetch',
      vi
        .fn<Window['fetch']>()
        .mockReturnValueOnce(old.promise)
        .mockResolvedValueOnce(response({ ...initial, selected: back })),
    )
    const callbacks = props()
    const view = render(<ImportCoverPicker {...callbacks} />)
    view.rerender(<ImportCoverPicker {...callbacks} draftId="second" />)
    expect(
      await screen.findByRole('img', { name: 'Selected cover' }),
    ).toHaveAttribute('src', back.url)
    await act(async () => {
      old.resolve(response())
      await old.promise
    })
    expect(screen.getByRole('img', { name: 'Selected cover' })).toHaveAttribute(
      'src',
      back.url,
    )
  })
  it('serializes choices and ignores an old save after switching drafts', async () => {
    const save = deferred<Response>()
    const fetch = vi
      .fn<Window['fetch']>()
      .mockResolvedValueOnce(response())
      .mockReturnValueOnce(save.promise)
      .mockResolvedValueOnce(response())
    vi.stubGlobal('fetch', fetch)
    const callbacks = props()
    const view = render(<ImportCoverPicker {...callbacks} />)
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: 'Use back.jpg as cover' }),
    )
    expect(screen.getByRole('button', { name: 'No cover' })).toBeDisabled()
    expect(screen.getByLabelText('Upload cover image')).toBeDisabled()
    const second = props()
    view.rerender(<ImportCoverPicker {...second} draftId="second" />)
    await screen.findByRole('img', { name: 'Selected cover' })
    await act(async () => {
      save.resolve(response({ ...initial, selected: back }))
      await save.promise
    })
    expect(callbacks.onSelection).not.toHaveBeenCalled()
    expect(second.onSelection).not.toHaveBeenCalled()
    expect(screen.getByRole('img', { name: 'Selected cover' })).toHaveAttribute(
      'src',
      front.url,
    )
    expect(fetch).toHaveBeenCalledTimes(3)
  })
  it('uses the latest metadata callback when a save completes', async () => {
    const save = deferred<Response>()
    vi.stubGlobal(
      'fetch',
      vi
        .fn<Window['fetch']>()
        .mockResolvedValueOnce(response())
        .mockReturnValueOnce(save.promise),
    )
    const callbacks = props()
    const view = render(<ImportCoverPicker {...callbacks} />)
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: 'Use back.jpg as cover' }),
    )
    const latest = vi.fn<(path: string | null) => void>()
    view.rerender(<ImportCoverPicker {...callbacks} onSelection={latest} />)
    await act(async () => {
      save.resolve(response({ ...initial, selected: back }))
      await save.promise
    })
    expect(callbacks.onSelection).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledWith(back.sourcePath)
  })
  it('offers retry after load errors and respects read-only drafts', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<Window['fetch']>()
        .mockRejectedValueOnce(new Error('Offline'))
        .mockResolvedValueOnce(response({ ...initial, canEdit: false })),
    )
    render(<ImportCoverPicker {...props()} />)
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: 'Retry cover images' }),
    )
    await screen.findByRole('img', { name: 'Selected cover' })
    expect(screen.getByRole('button', { name: 'No cover' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Use back.jpg as cover' }),
    ).toBeDisabled()
  })
})
