import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TrackStackTargetSearch } from './TrackStackPickerDialog'
import {
  deferred,
  page,
  renderPicker,
  target,
} from './TrackStackPickerDialog.testUtils'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('TrackStackPickerDialog search', () => {
  it('focuses search and shows the pinned source summary', async () => {
    renderPicker()
    const dialog = screen.getByRole('dialog', {
      name: 'Choose destination stack',
    })
    expect(within(dialog).getByText('Step 1 of 2')).toBeVisible()
    const source = within(dialog).getByRole('region', { name: 'Source track' })
    expect(source).toHaveTextContent('Source Track')
    expect(source).toHaveTextContent('Source Artist')
    await waitFor(() =>
      expect(
        within(dialog).getByRole('searchbox', { name: 'Search stacks' }),
      ).toHaveFocus(),
    )
  })

  it('does not search a trimmed query shorter than two characters', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const searchTargets = vi.fn<TrackStackTargetSearch>()
    renderPicker({ searchTargets })
    await user.type(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
      ' a ',
    )
    await advance(500)
    expect(searchTargets).not.toHaveBeenCalled()
  })

  it('debounces search by two hundred fifty milliseconds', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const searchTargets = vi
      .fn<TrackStackTargetSearch>()
      .mockResolvedValue(page([]))
    renderPicker({ searchTargets })
    await user.type(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
      'bass',
    )
    await advance(249)
    expect(searchTargets).not.toHaveBeenCalled()
    await advance(1)
    expect(searchTargets.mock.calls[0][0]).toEqual({
      sourceTrackId: 'source-track',
      search: 'bass',
      offset: 0,
      limit: 20,
    })
    expect(searchTargets.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('aborts the prior request and ignores a stale resolved response', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const first = deferred<ReturnType<typeof page>>()
    const second = deferred<ReturnType<typeof page>>()
    const searchTargets = vi
      .fn<TrackStackTargetSearch>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    renderPicker({ searchTargets })
    const input = screen.getByRole('searchbox', { name: 'Search stacks' })
    await user.type(input, 'old')
    await advance(250)
    const firstSignal = searchTargets.mock.calls[0][1]?.signal
    expect(firstSignal?.aborted).toBe(false)
    await user.clear(input)
    await user.type(input, 'new')
    expect(firstSignal?.aborted).toBe(true)
    await advance(250)
    await act(async () => {
      second.resolve(
        page([target({ rootTrackId: 'new-root', title: 'New destination' })]),
      )
      await second.promise
    })
    expect(screen.getByRole('radio', { name: /New destination/ })).toBeVisible()
    await act(async () => {
      first.resolve(
        page([target({ rootTrackId: 'old-root', title: 'Stale destination' })]),
      )
      await first.promise
    })
    expect(
      screen.queryByRole('radio', { name: /Stale destination/ }),
    ).not.toBeInTheDocument()
  })

  it('clears pages and selection only when the normalized query changes', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const searchTargets = vi
      .fn<TrackStackTargetSearch>()
      .mockResolvedValue(page([target()]))
    renderPicker({ searchTargets })
    const input = screen.getByRole('searchbox', { name: 'Search stacks' })
    await user.type(input, 'bass')
    await advance(250)
    const destination = screen.getByRole('radio', { name: /Destination Root/ })
    await user.click(destination)
    fireEvent.change(input, { target: { value: ' BASS ' } })
    await advance(250)
    expect(searchTargets).toHaveBeenCalledTimes(1)
    expect(destination).toBeChecked()
    fireEvent.change(input, { target: { value: 'different' } })
    expect(
      screen.queryByRole('radio', { name: /Destination Root/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('renders member context once for a matching destination root', async () => {
    const user = userEvent.setup()
    renderPicker({
      searchTargets: vi.fn<TrackStackTargetSearch>().mockResolvedValue(
        page([
          target({
            matchedMember: {
              trackId: 'matched-member',
              title: 'Aquagen More Bass Mix',
              artistDisplay: 'Aquagen',
            },
          }),
        ]),
      ),
    })
    await user.type(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
      'aquagen',
    )
    const radio = await screen.findByRole('radio', {
      name: /Destination Root/,
    })
    const row = radio.closest('label')
    expect(row).not.toBeNull()
    expect(
      within(row!).getAllByText('Matched member: Aquagen More Bass Mix'),
    ).toHaveLength(1)
  })

  it('retries a first-page failure without showing stale results', async () => {
    const user = userEvent.setup()
    const searchTargets = vi
      .fn<TrackStackTargetSearch>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(page([target()]))
    renderPicker({ searchTargets })
    await user.type(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
      'bass',
    )
    expect(
      await screen.findByText('Could not search stacks. Try again.'),
    ).toBeVisible()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Retry stack search' }))
    expect(
      await screen.findByRole('radio', { name: /Destination Root/ }),
    ).toBeVisible()
    expect(searchTargets.mock.calls.map(([request]) => request.offset)).toEqual(
      [0, 0],
    )
  })

  it('keeps results and selection through load-more failure and retry', async () => {
    const user = userEvent.setup()
    const firstPage = Array.from({ length: 20 }, (_, index) =>
      target({
        rootTrackId: `destination-${index}`,
        title: `Destination ${index}`,
        artistDisplay: `Artist ${index}`,
      }),
    )
    const searchTargets = vi
      .fn<TrackStackTargetSearch>()
      .mockResolvedValueOnce(page(firstPage, { total: 21 }))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(
        page(
          [target({ rootTrackId: 'destination-20', title: 'Destination 20' })],
          {
            offset: 20,
            total: 21,
          },
        ),
      )
    renderPicker({ searchTargets })
    await user.type(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
      'destination',
    )
    const selected = await screen.findByRole('radio', {
      name: /Destination 0/,
    })
    await user.click(selected)
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(
      await screen.findByText(
        'Could not load more stacks. Existing results are still available.',
      ),
    ).toBeVisible()
    expect(screen.getAllByRole('radio')).toHaveLength(20)
    expect(selected).toBeChecked()
    await user.click(
      screen.getByRole('button', { name: 'Retry loading more stacks' }),
    )
    expect(
      await screen.findByRole('radio', { name: /Destination 20/ }),
    ).toBeVisible()
    expect(screen.getAllByRole('radio')).toHaveLength(21)
    expect(selected).toBeChecked()
    expect(searchTargets.mock.calls.map(([request]) => request.offset)).toEqual(
      [0, 20, 20],
    )
  })

  it('requires a destination before continuing', async () => {
    const user = userEvent.setup()
    renderPicker()
    const continueButton = screen.getByRole('button', { name: 'Continue' })
    expect(continueButton).toBeDisabled()
    await user.type(
      screen.getByRole('searchbox', { name: 'Search stacks' }),
      'bass',
    )
    const destination = await screen.findByRole('radio', {
      name: /Destination Root/,
    })
    expect(continueButton).toBeDisabled()
    await user.click(destination)
    expect(continueButton).toBeEnabled()
  })
})

async function advance(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds)
  })
}
