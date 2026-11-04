import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DiscoverWorkspace } from './DiscoverWorkspace'
import {
  deferred,
  installDiscoverBridge,
  testDiscoverRelease,
  testDiscoverStatus,
} from './discoverTestFixtures'
import type { DiscoverResult } from './discoverTypes'

afterEach(() => {
  cleanup()
  Object.defineProperty(window, 'discweaveDesktop', {
    configurable: true,
    value: undefined,
  })
  vi.unstubAllGlobals()
})

async function renderReady() {
  const user = userEvent.setup()
  const onNavigate = vi.fn().mockReturnValue(true)
  const view = render(<DiscoverWorkspace onNavigateToUrl={onNavigate} />)
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Generate 10' })).toBeEnabled(),
  )
  return { user, onNavigate, ...view }
}

describe('Discover workspace', () => {
  it('generates verified release results without a seed and honestly shows a short batch', async () => {
    const bridge = installDiscoverBridge()
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Generate 10' }))
    expect(bridge.generate).toHaveBeenCalledWith({ mode: 'familiar' })
    expect(
      await screen.findByRole('heading', { name: 'Verified release 123' }),
    ).toBeVisible()
    expect(screen.getByText('1 recommended release')).toBeVisible()
    expect(screen.getByText(/does not invent results/)).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'View on Discogs' }),
    ).toHaveAttribute('href', 'https://www.discogs.com/release/123')
    expect(
      screen.getByRole('link', { name: 'Search Apple Music' }),
    ).toHaveAttribute(
      'href',
      'https://music.apple.com/search?term=Test%20Artist%20Verified%20release%20123',
    )
    expect(screen.getByText(/not a verified album match/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Another 10' })).toBeEnabled()
  })

  it('preserves previous results when another generation fails', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ items: [testDiscoverRelease()], message: '' })
      .mockRejectedValueOnce(new Error('Secret private provider response'))
    installDiscoverBridge({ generate })
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Generate 10' }))
    await user.click(await screen.findByRole('button', { name: 'Another 10' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Previous results are unchanged',
    )
    expect(
      screen.getByRole('heading', { name: 'Verified release 123' }),
    ).toBeVisible()
    expect(
      screen.queryByText('Secret private provider response'),
    ).not.toBeInTheDocument()
  })

  it('blocks repeated generation and ignores late results after cancellation', async () => {
    const request = deferred<DiscoverResult>()
    const generate = vi.fn().mockReturnValue(request.promise)
    const bridge = installDiscoverBridge({ generate })
    const { user } = await renderReady()
    await user.dblClick(screen.getByRole('button', { name: 'Generate 10' }))
    expect(generate).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(bridge.cancel).toHaveBeenCalledTimes(1)
    await act(async () => {
      request.resolve({ items: [testDiscoverRelease()], message: '' })
      await request.promise
    })
    expect(
      screen.queryByRole('heading', { name: 'Verified release 123' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/Generation cancelled/)).toBeVisible()
  })

  it('cancels generation when leaving the workspace and ignores late results', async () => {
    const request = deferred<DiscoverResult>()
    const bridge = installDiscoverBridge({
      generate: vi.fn().mockReturnValue(request.promise),
    })
    const { user, unmount } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Generate 10' }))
    unmount()
    expect(bridge.cancel).toHaveBeenCalledTimes(1)
    await act(async () => {
      request.resolve({ items: [testDiscoverRelease()], message: '' })
      await request.promise
    })
    expect(
      screen.queryByRole('heading', { name: 'Verified release 123' }),
    ).not.toBeInTheDocument()
  })

  it('sends distinct feedback choices only after the explicit click', async () => {
    installDiscoverBridge({
      generate: vi.fn().mockResolvedValue({
        items: [testDiscoverRelease(), testDiscoverRelease('456')],
        message: '',
      }),
    })
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Generate 10' }))
    expect(fetchMock).not.toHaveBeenCalled()
    await user.click(
      await screen.findByRole('button', { name: 'Already know' }),
    )
    expect(requestBody(fetchMock.mock.calls[0][1])).toEqual({
      externalId: '123',
      kind: 'alreadyKnow',
    })
    expect(await screen.findByText(/not a dislike rating/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Not interested' }))
    expect(requestBody(fetchMock.mock.calls[1][1])).toEqual({
      externalId: '456',
      kind: 'notInterested',
    })
    expect(await screen.findByText('0 recommended releases')).toBeVisible()
  })

  it('opens an explicit Wanted review without confirming or creating a catalog item', async () => {
    installDiscoverBridge()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id: 'session-1', drafts: [{ id: 'draft-1' }] }),
          { status: 200 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)
    const { user, onNavigate } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Generate 10' }))
    await user.click(
      await screen.findByRole('button', { name: 'Review for Wanted' }),
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/imports/recommended-release-drafts',
    )
    expect(requestBody(fetchMock.mock.calls[0][1])).toEqual({
      discogsReleaseId: '123',
      idempotencyKey: expect.any(String) as unknown,
    })
    expect(onNavigate).toHaveBeenCalledWith(
      '/imports?session=session-1&draft=draft-1',
    )
  })

  it('retains the same idempotency key when retrying an uncertain draft creation', async () => {
    installDiscoverBridge()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 'session-1', drafts: [{ id: 'draft-1' }] }),
          { status: 200 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Generate 10' }))
    await user.click(
      await screen.findByRole('button', { name: 'Review for Wanted' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('check Imports')
    await user.click(screen.getByRole('button', { name: 'Review for Wanted' }))
    expect(fetchMock.mock.calls[0][1]?.body).toBe(
      fetchMock.mock.calls[1][1]?.body,
    )
  })

  it('does not generate before metadata consent and explains browser limitations', async () => {
    const bridge = installDiscoverBridge({
      status: vi
        .fn()
        .mockResolvedValue(testDiscoverStatus({ consented: false })),
    })
    const user = userEvent.setup()
    const { unmount } = render(<DiscoverWorkspace onNavigateToUrl={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Generate 10' }))
    expect(bridge.generate).not.toHaveBeenCalled()
    expect(screen.getByText(/allow metadata sharing/)).toBeVisible()
    unmount()
    Object.defineProperty(window, 'discweaveDesktop', {
      configurable: true,
      value: undefined,
    })
    render(<DiscoverWorkspace onNavigateToUrl={vi.fn()} />)
    expect(screen.getByText(/Open DiscWeave desktop/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Generate 10' })).toBeDisabled()
  })

  it('ignores an old contextual response after keyed route navigation', async () => {
    const oldRequest = deferred<DiscoverResult>()
    const nextRequest = deferred<DiscoverResult>()
    const bridge = installDiscoverBridge({
      generate: vi
        .fn()
        .mockReturnValueOnce(oldRequest.promise)
        .mockReturnValueOnce(nextRequest.promise),
    })
    const user = userEvent.setup()
    const { rerender } = render(
      <DiscoverWorkspace
        key="?release=first"
        locationSearch="?release=first"
        onNavigateToUrl={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Generate 10' })).toBeEnabled(),
    )
    await user.click(screen.getByRole('button', { name: 'Generate 10' }))
    rerender(
      <DiscoverWorkspace
        key="?release=next"
        locationSearch="?release=next"
        onNavigateToUrl={vi.fn()}
      />,
    )
    expect(bridge.cancel).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Generate 10' })).toBeEnabled(),
    )
    await user.click(screen.getByRole('button', { name: 'Generate 10' }))
    await act(async () => {
      oldRequest.resolve({ items: [testDiscoverRelease('123')], message: '' })
      nextRequest.resolve({ items: [testDiscoverRelease('456')], message: '' })
      await Promise.all([oldRequest.promise, nextRequest.promise])
    })
    expect(
      screen.queryByRole('heading', { name: 'Verified release 123' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Verified release 456' }),
    ).toBeVisible()
  })

  it('does not start another generation until cancellation is acknowledged', async () => {
    const request = deferred<DiscoverResult>()
    const cancellation = deferred<void>()
    const bridge = installDiscoverBridge({
      generate: vi.fn().mockReturnValue(request.promise),
      cancel: vi.fn().mockReturnValue(cancellation.promise),
    })
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Generate 10' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(
      screen.getByRole('button', { name: 'Finding releases…' }),
    ).toBeDisabled()
    expect(bridge.generate).toHaveBeenCalledTimes(1)
    await act(async () => {
      cancellation.resolve()
      await cancellation.promise
    })
    expect(screen.getByRole('button', { name: 'Generate 10' })).toBeEnabled()
  })

  it('keeps a release visible when its feedback fails to save', async () => {
    installDiscoverBridge()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new Error('network unavailable')),
    )
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Generate 10' }))
    await user.click(
      await screen.findByRole('button', { name: 'Not interested' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Feedback could not be saved',
    )
    expect(
      screen.getByRole('heading', { name: 'Verified release 123' }),
    ).toBeVisible()
  })

  it('passes optional track context while still requesting release recommendations', async () => {
    const bridge = installDiscoverBridge()
    const user = userEvent.setup()
    render(
      <DiscoverWorkspace
        locationSearch="?track=track-1"
        onNavigateToUrl={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Generate 10' })).toBeEnabled(),
    )
    await user.selectOptions(
      screen.getByLabelText('Exploration'),
      'adventurous',
    )
    await user.click(screen.getByRole('button', { name: 'Generate 10' }))
    expect(bridge.generate).toHaveBeenCalledWith({
      mode: 'adventurous',
      trackId: 'track-1',
    })
    expect(screen.getByText(/Results are always releases/)).toBeVisible()
  })
})

function requestBody(init: RequestInit | undefined): unknown {
  if (typeof init?.body !== 'string') throw new Error('Expected a JSON request')
  return JSON.parse(init.body) as unknown
}
