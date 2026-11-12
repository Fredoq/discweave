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
import { PlaylistSuggestionsPanel } from './PlaylistSuggestionsPanel'
import type {
  PlaylistSuggestionResult,
  PlaylistSuggestionsBridge,
} from './playlistSuggestionTypes'

function preview(): PlaylistSuggestionResult {
  return {
    items: [
      {
        trackId: 'track-A',
        title: 'Warm Signals',
        artist: 'Demo artist',
        releaseTitle: 'Night album',
        reason: 'Tagged ambient and rated highly',
      },
      {
        trackId: 'track-B',
        title: 'Late Return',
        artist: 'Other artist',
        releaseTitle: 'Second album',
        reason: 'Fits the requested year',
      },
    ],
    interpreted: ['Ambient tracks'],
    warnings: ['Some tracks lack ratings'],
    examined: 120,
    matched: 80,
    shortlisted: 50,
  }
}
function setupBridge(configured = true) {
  const status = vi
    .fn<PlaylistSuggestionsBridge['status']>()
    .mockResolvedValue({ configured, model: 'demo-model' })
  const generate = vi
    .fn<PlaylistSuggestionsBridge['generate']>()
    .mockResolvedValue(preview())
  const cancel = vi
    .fn<PlaylistSuggestionsBridge['cancel']>()
    .mockResolvedValue(undefined)
  vi.stubGlobal('discweaveDesktop', {
    isDesktop: true,
    playlistSuggestions: { status, generate, cancel },
  })
  return { status, generate, cancel }
}
async function consentAndGenerate() {
  const user = userEvent.setup()
  await screen.findByText(/Model: demo-model/)
  await user.type(screen.getByRole('textbox'), 'Late-night ambient')
  await user.click(screen.getByRole('checkbox'))
  await user.click(screen.getByRole('button', { name: 'Generate suggestions' }))
  return user
}
afterEach(() => vi.unstubAllGlobals())

describe('PlaylistSuggestionsPanel', () => {
  it('requires unchecked consent and a prompt and never generates automatically', async () => {
    const bridge = setupBridge()
    const user = userEvent.setup()
    render(
      <PlaylistSuggestionsPanel
        existingTrackIds={['existing', 'existing']}
        onAdd={vi.fn(() => 0)}
        onClose={vi.fn()}
      />,
    )
    await screen.findByText(/Model: demo-model/)
    expect(bridge.generate).not.toHaveBeenCalled()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(
      screen.getByRole('button', { name: 'Generate suggestions' }),
    ).toBeDisabled()
    await user.type(screen.getByRole('textbox'), '  Late-night ambient  ')
    expect(
      screen.getByRole('button', { name: 'Generate suggestions' }),
    ).toBeDisabled()
    await user.click(screen.getByRole('checkbox'))
    await user.click(
      screen.getByRole('button', { name: 'Generate suggestions' }),
    )
    expect(bridge.generate).toHaveBeenCalledWith({
      prompt: 'Late-night ambient',
      excludedTrackIds: ['existing'],
      consented: true,
    })
    expect(screen.getByText(/up to 2 paid requests/)).toBeInTheDocument()
    expect(
      screen.getByText(/No audio, file paths or private notes/),
    ).toBeInTheDocument()
  })
  it('previews without mutation then adds only explicitly checked nonexisting IDs to the draft', async () => {
    setupBridge()
    const add = vi.fn(() => 1)
    render(
      <PlaylistSuggestionsPanel
        existingTrackIds={['track-B']}
        onAdd={add}
        onClose={vi.fn()}
      />,
    )
    const user = await consentAndGenerate()
    const results = await screen.findByRole('region', {
      name: 'Suggestion preview',
    })
    const choices = within(results).getAllByRole('checkbox')
    expect(choices[0]).not.toBeChecked()
    expect(choices[1]).toBeDisabled()
    expect(add).not.toHaveBeenCalled()
    expect(
      within(results).getByRole('button', { name: 'Add selected' }),
    ).toBeDisabled()
    await user.click(choices[0])
    await user.click(screen.getByRole('button', { name: 'Add selected (1)' }))
    expect(add).toHaveBeenCalledWith(['track-A'])
    expect(
      screen.getByText(/Save the playlist when you are ready/),
    ).toBeInTheDocument()
    expect(choices[0]).not.toBeChecked()
  })
  it('reports zero additions when the parent rejects a now-unavailable track', async () => {
    const bridge = setupBridge()
    bridge.generate.mockResolvedValue({
      ...preview(),
      items: [{ ...preview().items[0], trackId: 'unknown-provider-id' }],
    })
    const add = vi.fn(() => 0)
    render(
      <PlaylistSuggestionsPanel
        existingTrackIds={[]}
        onAdd={add}
        onClose={vi.fn()}
      />,
    )
    const user = await consentAndGenerate()
    const results = await screen.findByRole('region', {
      name: 'Suggestion preview',
    })
    await user.click(within(results).getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Add selected (1)' }))
    expect(add).toHaveBeenCalledWith(['unknown-provider-id'])
    expect(screen.getByText(/No tracks added/)).toBeInTheDocument()
    expect(
      screen.queryByText(/Save the playlist when you are ready/),
    ).not.toBeInTheDocument()
  })
  it('preserves the previous preview and selection on error and resets selection only after success', async () => {
    const bridge = setupBridge()
    render(
      <PlaylistSuggestionsPanel
        existingTrackIds={[]}
        onAdd={vi.fn(() => 0)}
        onClose={vi.fn()}
      />,
    )
    const user = await consentAndGenerate()
    const results = await screen.findByRole('region', {
      name: 'Suggestion preview',
    })
    await user.click(within(results).getAllByRole('checkbox')[0])
    bridge.generate.mockRejectedValueOnce(new Error('Provider unavailable'))
    await user.click(
      screen.getByRole('button', { name: 'Generate suggestions' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Provider unavailable',
    )
    expect(within(results).getAllByRole('checkbox')[0]).toBeChecked()
    expect(screen.getByText('Warm Signals')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Generate suggestions' }),
    )
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    )
    expect(within(results).getAllByRole('checkbox')[0]).not.toBeChecked()
  })
  it('cancels its own pending request and ignores a late completion while keeping earlier selections', async () => {
    const bridge = setupBridge()
    render(
      <PlaylistSuggestionsPanel
        existingTrackIds={[]}
        onAdd={vi.fn(() => 0)}
        onClose={vi.fn()}
      />,
    )
    const user = await consentAndGenerate()
    const results = await screen.findByRole('region', {
      name: 'Suggestion preview',
    })
    await user.click(within(results).getAllByRole('checkbox')[0])
    let finish!: (value: PlaylistSuggestionResult) => void
    bridge.generate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Generate suggestions' }),
    )
    await user.click(screen.getByRole('button', { name: 'Cancel request' }))
    expect(bridge.cancel).toHaveBeenCalledOnce()
    expect(within(results).getAllByRole('checkbox')[0]).toBeChecked()
    await act(async () => {
      finish({ ...preview(), items: [] })
      await Promise.resolve()
    })
    expect(screen.getByText('Warm Signals')).toBeInTheDocument()
    expect(within(results).getAllByRole('checkbox')[0]).toBeChecked()
  })
  it('prevents double generation and cancels only active owned work on unmount', async () => {
    const bridge = setupBridge()
    bridge.generate.mockImplementation(() => new Promise(() => {}))
    const rendered = render(
      <PlaylistSuggestionsPanel
        existingTrackIds={[]}
        onAdd={vi.fn(() => 0)}
        onClose={vi.fn()}
      />,
    )
    const user = userEvent.setup()
    await screen.findByText(/Model: demo-model/)
    await user.type(screen.getByRole('textbox'), 'Ambient')
    await user.click(screen.getByRole('checkbox'))
    const button = screen.getByRole('button', { name: 'Generate suggestions' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(bridge.generate).toHaveBeenCalledOnce()
    expect(button).toBeDisabled()
    rendered.unmount()
    expect(bridge.cancel).toHaveBeenCalledOnce()
    const idle = render(
      <PlaylistSuggestionsPanel
        existingTrackIds={[]}
        onAdd={vi.fn(() => 0)}
        onClose={vi.fn()}
      />,
    )
    await screen.findByText(/Model: demo-model/)
    idle.unmount()
    expect(bridge.cancel).toHaveBeenCalledOnce()
  })
  it('shows empty coverage and metadata-only limitations without enabling Add', async () => {
    const bridge = setupBridge()
    bridge.generate.mockResolvedValue({
      items: [],
      interpreted: [],
      warnings: ['No matching metadata'],
      examined: 20,
      matched: 0,
      shortlisted: 0,
    })
    render(
      <PlaylistSuggestionsPanel
        existingTrackIds={[]}
        onAdd={vi.fn(() => 0)}
        onClose={vi.fn()}
      />,
    )
    await consentAndGenerate()
    expect(
      await screen.findByText('20 tracks examined · 0 matched · 0 shortlisted'),
    ).toBeInTheDocument()
    expect(screen.getByText(/not audio analysis/)).toBeInTheDocument()
    expect(screen.getByText('No matching metadata')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add selected' })).toBeDisabled()
  })
  it('explains missing key or desktop capability without generating', async () => {
    const bridge = setupBridge(false)
    const rendered = render(
      <PlaylistSuggestionsPanel
        existingTrackIds={[]}
        onAdd={vi.fn(() => 0)}
        onClose={vi.fn()}
      />,
    )
    expect(
      await screen.findByText(/Configure your OpenAI API key in Settings/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Generate suggestions' }),
    ).toBeDisabled()
    expect(bridge.generate).not.toHaveBeenCalled()
    rendered.unmount()
    vi.stubGlobal('discweaveDesktop', undefined)
    render(
      <PlaylistSuggestionsPanel
        existingTrackIds={[]}
        onAdd={vi.fn(() => 0)}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'require the desktop app',
    )
    expect(
      screen.getByRole('button', { name: 'Generate suggestions' }),
    ).toBeDisabled()
  })
})
