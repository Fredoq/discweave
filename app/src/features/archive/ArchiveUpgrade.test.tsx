import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ArchiveUpgradeNotice } from './ArchiveUpgradeNotice'
import { ArchiveUpgradeProvider } from './ArchiveUpgradeProvider'
import { LabelImportsSection } from '../labels/LabelImportsSection'
import { CatalogApiError } from '../catalog/api/httpClient'
import { loadLabelImports } from '../labels/labelImportsApi'

vi.mock('../labels/labelImportsApi', () => ({
  loadLabelImports: vi.fn(),
  linkLabelImport: vi.fn(),
  unlinkLabelImport: vi.fn(),
}))
const getStatus = vi.fn()
const backupAndUpgrade = vi.fn()
const onReady = vi.fn()
function setup() {
  return render(
    <ArchiveUpgradeProvider>
      <ArchiveUpgradeNotice onReady={onReady} />
    </ArchiveUpgradeProvider>,
  )
}
beforeEach(() => {
  vi.resetAllMocks()
  getStatus.mockResolvedValue({ status: 'upgradeRequired', canUpgrade: true })
  backupAndUpgrade.mockResolvedValue({
    status: 'upgraded',
    code: null,
    backupDirectory: '/test/backups/verified',
  })
  vi.stubGlobal('discweaveDesktop', {
    isDesktop: true,
    archive: { getStatus, backupAndUpgrade },
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('Archive upgrade user decisions', () => {
  it('does not upgrade when the user postpones and leaves existing work available', async () => {
    setup()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Not now' }),
    )
    expect(screen.getByRole('status')).toHaveTextContent('Upgrade postponed')
    expect(backupAndUpgrade).not.toHaveBeenCalled()
    expect(onReady).not.toHaveBeenCalled()
  })

  it('runs only after an explicit click and presents the verified backup path', async () => {
    setup()
    const button = await screen.findByRole('button', {
      name: 'Back up and upgrade',
    })
    expect(backupAndUpgrade).not.toHaveBeenCalled()
    await userEvent.click(button)
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'Collection ready',
    )
    expect(screen.getByText('/test/backups/verified')).toBeInTheDocument()
    expect(backupAndUpgrade).toHaveBeenCalledTimes(1)
    expect(onReady).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('serializes repeated clicks and blocks dismissal while the archive operation runs', async () => {
    let finish!: (value: unknown) => void
    backupAndUpgrade.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    setup()
    const button = await screen.findByRole('button', {
      name: 'Back up and upgrade',
    })
    await userEvent.click(button)
    fireEvent.click(button)
    expect(backupAndUpgrade).toHaveBeenCalledTimes(1)
    const dialog = screen.getByRole('dialog')
    const cancel = new Event('cancel', { bubbles: true, cancelable: true })
    fireEvent(dialog, cancel)
    expect(cancel.defaultPrevented).toBe(true)
    expect(
      screen.queryByRole('button', { name: 'Done' }),
    ).not.toBeInTheDocument()
    await act(async () => {
      finish({ status: 'current', code: null, backupDirectory: null })
      await Promise.resolve()
    })
    expect(
      await screen.findByRole('button', { name: 'Done' }),
    ).toBeInTheDocument()
  })

  it('keeps progress and the result visible even if the originating view changes', async () => {
    let finish!: (value: unknown) => void
    backupAndUpgrade.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const view = setup()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Back up and upgrade' }),
    )
    view.rerender(
      <ArchiveUpgradeProvider>
        <p>Another workspace</p>
      </ArchiveUpgradeProvider>,
    )
    expect(screen.getByRole('dialog')).toHaveTextContent('Backing up')
    await act(async () => {
      finish({
        status: 'upgraded',
        code: null,
        backupDirectory: '/test/backup',
      })
      await Promise.resolve()
    })
    expect(screen.getByRole('dialog')).toHaveTextContent('Collection ready')
  })

  it('does not report success when backup or upgrade was blocked', async () => {
    backupAndUpgrade.mockResolvedValue({
      status: 'blocked',
      code: 'backup.failed',
      backupDirectory: null,
    })
    setup()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Back up and upgrade' }),
    )
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'Upgrade needs attention',
    )
    expect(onReady).not.toHaveBeenCalled()
    expect(screen.queryByText('/test/backups/verified')).not.toBeInTheDocument()
  })

  it('handles a disrupted runtime without claiming that the archive was unchanged', async () => {
    backupAndUpgrade.mockRejectedValue(new Error('runtime stopped'))
    setup()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Back up and upgrade' }),
    )
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'Reopen DiscWeave',
    )
    expect(onReady).not.toHaveBeenCalled()
  })

  it('never offers automatic changes to an unknown schema', async () => {
    getStatus.mockResolvedValue({ status: 'unsupported', canUpgrade: false })
    setup()
    await screen.findByText('This collection needs a compatibility check')
    expect(
      screen.queryByRole('button', { name: 'Back up and upgrade' }),
    ).not.toBeInTheDocument()
    expect(backupAndUpgrade).not.toHaveBeenCalled()
  })

  it('guides web users to the supported desktop or administrator path without a retry loop', async () => {
    vi.stubGlobal('discweaveDesktop', undefined)
    setup()
    expect(
      await screen.findByText(/Open the packaged desktop app/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /upgrade|retry/i }),
    ).not.toBeInTheDocument()
    expect(getStatus).not.toHaveBeenCalled()
  })

  it('recognizes an upgrade performed elsewhere and reloads without running it again', async () => {
    getStatus.mockResolvedValue({ status: 'current', canUpgrade: false })
    setup()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Reload updated collection' }),
    )
    expect(onReady).toHaveBeenCalledOnce()
    expect(backupAndUpgrade).not.toHaveBeenCalled()
  })

  it('renders an upgrade action instead of generic retry for the missing-table response', async () => {
    const error = await CatalogApiError.fromResponse(
      new Response(
        JSON.stringify({
          code: 'schema.upgrade_required',
          message: 'Upgrade required',
        }),
        { status: 409 },
      ),
    )
    vi.mocked(loadLabelImports)
      .mockRejectedValueOnce(error)
      .mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 })
    render(
      <ArchiveUpgradeProvider>
        <LabelImportsSection labelId="label" />
      </ArchiveUpgradeProvider>,
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Back up and upgrade' }),
    )
    await waitFor(() =>
      expect(screen.getByText('No linked imports yet.')).toBeInTheDocument(),
    )
    expect(
      screen.queryByText('Could not load linked imports. Try again.'),
    ).not.toBeInTheDocument()
  })
})

it('does not mount authenticated collection workflows when the schema is unknown', async () => {
  getStatus.mockResolvedValue({
    status: 'unsupported',
    canUpgrade: false,
    code: 'schema.unsupported',
  })
  render(
    <ArchiveUpgradeProvider>
      <p>Authenticated workflows</p>
    </ArchiveUpgradeProvider>,
  )
  await screen.findByText('This collection needs a compatibility check')
  expect(screen.queryByText('Authenticated workflows')).not.toBeInTheDocument()
})

it('blocks editing on a failed compatibility check and permits an explicit read-only retry', async () => {
  getStatus
    .mockRejectedValueOnce(new Error('CLI unavailable'))
    .mockResolvedValue({ status: 'current', canUpgrade: false })
  render(
    <ArchiveUpgradeProvider>
      <p>Authenticated workflows</p>
    </ArchiveUpgradeProvider>,
  )
  await screen.findByText('Could not check collection compatibility')
  expect(screen.queryByText('Authenticated workflows')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Check again' }))
  await screen.findByText('Authenticated workflows')
  expect(backupAndUpgrade).not.toHaveBeenCalled()
})

it('leaves externally managed backends to their own schema guard', async () => {
  getStatus.mockResolvedValue({
    status: 'unsupported',
    canUpgrade: false,
    code: 'archive.external_backend',
  })
  render(
    <ArchiveUpgradeProvider>
      <p>Authenticated workflows</p>
    </ArchiveUpgradeProvider>,
  )
  await screen.findByText('Authenticated workflows')
  expect(backupAndUpgrade).not.toHaveBeenCalled()
})

it('preserves the backup and requires reopening after a failed backend restart', async () => {
  backupAndUpgrade.mockResolvedValue({
    status: 'blocked',
    code: 'archive.restart_failed',
    backupDirectory: '/test/verified-backup',
  })
  setup()
  await userEvent.click(
    await screen.findByRole('button', { name: 'Back up and upgrade' }),
  )
  expect(await screen.findByRole('dialog')).toHaveTextContent(
    'database may already be updated',
  )
  expect(screen.getByText('/test/verified-backup')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Done' }))
  expect(screen.getByText('Reopen DiscWeave to continue')).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Check again' }),
  ).not.toBeInTheDocument()
  expect(onReady).not.toHaveBeenCalled()
})

it('reports a successful upgrade with paused watched folders without hiding the backup', async () => {
  backupAndUpgrade.mockResolvedValue({
    status: 'upgraded',
    code: 'archive.watches_paused',
    backupDirectory: '/test/verified-backup',
  })
  setup()
  await userEvent.click(
    await screen.findByRole('button', { name: 'Back up and upgrade' }),
  )
  expect(await screen.findByRole('dialog')).toHaveTextContent(
    'Restart DiscWeave to resume watched-folder checks',
  )
  expect(screen.getByText('/test/verified-backup')).toBeInTheDocument()
  expect(onReady).toHaveBeenCalledOnce()
})

it('keeps verified compatible custom storage available without offering the wrong upgrade target', async () => {
  getStatus.mockResolvedValue({
    status: 'upgradeRequired',
    canUpgrade: false,
    code: 'archive.configuration_unsupported',
  })
  setup()
  await screen.findByText(
    /Automatic upgrade is unavailable with custom storage/,
  )
  expect(
    screen.queryByRole('button', { name: 'Back up and upgrade' }),
  ).not.toBeInTheDocument()
  expect(backupAndUpgrade).not.toHaveBeenCalled()
})
