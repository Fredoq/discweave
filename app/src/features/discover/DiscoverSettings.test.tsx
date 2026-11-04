import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DiscoverSettings } from './DiscoverSettings'
import {
  installDiscoverBridge,
  testDiscoverStatus,
} from './discoverTestFixtures'

afterEach(() => {
  cleanup()
  Object.defineProperty(window, 'discweaveDesktop', {
    configurable: true,
    value: undefined,
  })
})

describe('Recommendation settings', () => {
  it('requires an explicit key save and metadata opt-in without persisting the entry in browser storage', async () => {
    const bridge = installDiscoverBridge({
      status: vi
        .fn()
        .mockResolvedValue(
          testDiscoverStatus({ configured: false, consented: false }),
        ),
    })
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    const user = userEvent.setup()
    render(<DiscoverSettings />)
    await waitFor(() => expect(screen.getByLabelText('API key')).toBeEnabled())
    expect(screen.getByText(/up to 40 rated examples/)).toHaveTextContent(
      'up to 20 recently shown or dismissed',
    )
    expect(screen.getByText(/up to 40 rated examples/)).toHaveTextContent(
      'selected release or track',
    )
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled()
    await user.type(screen.getByLabelText('API key'), 'test-secret-not-real')
    expect(bridge.save).not.toHaveBeenCalled()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(bridge.save).toHaveBeenCalledWith({
      apiKey: 'test-secret-not-real',
      model: 'gpt-6-luna',
      consented: true,
    })
    expect(screen.getByLabelText('API key')).toHaveValue('')
    expect(storage).not.toHaveBeenCalled()
    storage.mockRestore()
  })

  it('shows session-only storage honestly and tests only the saved connection', async () => {
    const bridge = installDiscoverBridge({
      status: vi
        .fn()
        .mockResolvedValue(testDiscoverStatus({ storage: 'session' })),
    })
    const user = userEvent.setup()
    render(<DiscoverSettings />)
    expect(await screen.findByText(/Session only/)).toBeVisible()
    await user.click(screen.getByText('Request limits and connection checks'))
    expect(screen.getByText(/per app session/)).toBeVisible()
    expect(
      screen.getByText(/cancelled generations may still be billed/i),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Test connection' }))
    expect(bridge.test).toHaveBeenCalledTimes(1)
    expect(bridge.generate).not.toHaveBeenCalled()
    expect(await screen.findByText('Connection verified.')).toBeVisible()
  })

  it('removes the key and resets configured state without displaying the secret', async () => {
    const bridge = installDiscoverBridge()
    const user = userEvent.setup()
    render(<DiscoverSettings />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove key' })).toBeEnabled(),
    )
    await user.click(screen.getByRole('button', { name: 'Remove key' }))
    expect(bridge.remove).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('OpenAI key removed.')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Test connection' }),
    ).toBeDisabled()
    expect(screen.getByLabelText('API key')).toHaveValue('')
  })

  it('clears the key after a failed save and does not expose provider error contents', async () => {
    const bridge = installDiscoverBridge({
      save: vi
        .fn()
        .mockRejectedValue(new Error('provider returned test-secret-not-real')),
    })
    const user = userEvent.setup()
    render(<DiscoverSettings />)
    await waitFor(() => expect(screen.getByLabelText('API key')).toBeEnabled())
    await user.type(screen.getByLabelText('API key'), 'test-secret-not-real')
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(bridge.save).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByText(/operation could not be completed/),
    ).toBeVisible()
    expect(screen.getByLabelText('API key')).toHaveValue('')
    expect(screen.queryByText(/provider returned/)).not.toBeInTheDocument()
  })

  it('does not offer browser key input when the secure desktop bridge is absent', () => {
    render(<DiscoverSettings />)
    expect(screen.getByText(/No key is stored by this browser/)).toBeVisible()
    expect(screen.queryByLabelText('API key')).not.toBeInTheDocument()
  })

  it('allows revoking consent while retaining the configured key', async () => {
    const bridge = installDiscoverBridge()
    const user = userEvent.setup()
    render(<DiscoverSettings />)
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeChecked())
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(bridge.save).toHaveBeenCalledWith({
      apiKey: '',
      model: 'gpt-6-luna',
      consented: false,
    })
  })
  it('keeps material data, billing and retention disclosure visible before explicit consent', async () => {
    installDiscoverBridge({
      status: vi
        .fn()
        .mockResolvedValue(testDiscoverStatus({ consented: false })),
    })
    render(<DiscoverSettings />)
    const consent = await screen.findByRole('checkbox', {
      name: 'I allow Discover to send this metadata to OpenAI when I generate recommendations.',
    })
    await waitFor(() => expect(consent).toBeEnabled())
    const disclosure = screen.getByText(/up to 40 rated examples/)
    const billing = screen.getByText(/provider abuse-monitoring retention/)
    expect(disclosure).toBeVisible()
    expect(disclosure).toHaveTextContent(
      'No audio, local paths, notes, account details or feedback labels',
    )
    expect(billing).toBeVisible()
    expect(billing).toHaveTextContent('OpenAI bills actual usage')
    expect(billing).toHaveTextContent(
      'cancelled generations may still be billed',
    )
    expect(
      disclosure.compareDocumentPosition(consent) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      billing.compareDocumentPosition(consent) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(consent).toHaveAccessibleDescription(
      /up to 40 rated examples.*Paid API usage.*retention/,
    )
    expect(consent).not.toBeChecked()
    expect(
      screen
        .getByText('Request limits and connection checks')
        .closest('details'),
    ).not.toHaveAttribute('open')
  })

  it('groups compact connection controls separately from sharing and shows the provider as static text', async () => {
    installDiscoverBridge()
    const user = userEvent.setup()
    render(<DiscoverSettings />)
    expect(await screen.findByText('Key configured')).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'OpenAI connection' }),
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Data sharing and consent' }),
    ).toBeVisible()
    expect(screen.getByLabelText('Provider: OpenAI')).toHaveTextContent(
      'OpenAI',
    )
    expect(
      screen.queryByRole('textbox', { name: 'Provider' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Model' })).toBeEnabled()
    expect(screen.getByLabelText('API key')).toHaveAttribute('type', 'password')
    await user.click(screen.getByText('Request limits and connection checks'))
    expect(
      screen.getByText(/Test connection checks model access/),
    ).toBeVisible()
    expect(
      screen.getByText(/Test connection checks model access/),
    ).toHaveTextContent('does not generate recommendations')
  })
})
