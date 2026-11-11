import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LabelImportsSection } from './LabelImportsSection'
import { LabelsWorkspace } from './LabelsWorkspace'
import {
  linkLabelImport,
  loadLabelImports,
  unlinkLabelImport,
  type LabelImportSession,
} from './labelImportsApi'

vi.mock('./labelImportsApi', () => ({
  loadLabelImports: vi.fn(),
  linkLabelImport: vi.fn(),
  unlinkLabelImport: vi.fn(),
}))
const session: LabelImportSession = {
  id: 'session-a',
  sourceRoot: '/Music/Label',
  status: 'readyForReview',
  createdAt: '2026-11-11T10:00:00Z',
  updatedAt: '2026-11-11T10:00:00Z',
  archivedAt: null,
  pendingDraftCount: 2,
  confirmedDraftCount: 3,
  skippedDraftCount: 1,
  pendingLooseFileCount: 4,
}
const page = (items: LabelImportSession[]) => ({
  items,
  total: items.length,
  offset: 0,
  limit: 100,
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(loadLabelImports).mockResolvedValue(page([session]))
})

describe('Label import continuation', () => {
  it('shows pending counts and a direct session link without catalog completion claims', async () => {
    render(<LabelImportsSection labelId="label-a" />)
    expect(
      await screen.findByText('2 pending releases · 4 pending loose files'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Continue import' }),
    ).toHaveAttribute('href', '/imports?session=session-a&resume=pending')
    expect(screen.getByText(/not the label’s full catalog/)).toBeInTheDocument()
  })

  it('hides finished and archived imports until explicitly requested', async () => {
    vi.mocked(loadLabelImports).mockResolvedValue(
      page([
        { ...session, pendingDraftCount: 0, pendingLooseFileCount: 0 },
        {
          ...session,
          id: 'archived',
          sourceRoot: '/Music/Archived',
          archivedAt: session.createdAt,
        },
      ]),
    )
    render(<LabelImportsSection labelId="label-a" />)
    await screen.findByText('No pending materials in active linked imports.')
    expect(screen.queryByText('/Music/Label')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByText('/Music/Label')).toBeInTheDocument()
    expect(screen.getByText('/Music/Archived')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Open import' })).toHaveLength(2)
  })

  it('requires an explicit selection and cancels without creating a link', async () => {
    vi.mocked(loadLabelImports)
      .mockResolvedValueOnce(page([]))
      .mockResolvedValue(page([session]))
    render(<LabelImportsSection labelId="label-a" />)
    await screen.findByText('No linked imports yet.')
    await userEvent.click(screen.getByRole('button', { name: 'Link import' }))
    expect(
      await screen.findByRole('button', { name: 'Link selected import' }),
    ).toBeDisabled()
    await userEvent.selectOptions(screen.getByRole('combobox'), 'session-a')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(linkLabelImport).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Link import' }))
    expect(await screen.findByRole('combobox')).toHaveValue('')
  })

  it('links only the chosen session and reloads authoritative summaries', async () => {
    vi.mocked(loadLabelImports)
      .mockResolvedValueOnce(page([]))
      .mockResolvedValue(page([session]))
    render(<LabelImportsSection labelId="label-a" />)
    await screen.findByText('No linked imports yet.')
    await userEvent.click(screen.getByRole('button', { name: 'Link import' }))
    await screen.findByRole('combobox')
    await userEvent.selectOptions(screen.getByRole('combobox'), 'session-a')
    await userEvent.click(
      screen.getByRole('button', { name: 'Link selected import' }),
    )
    await screen.findByRole('link', { name: 'Continue import' })
    expect(linkLabelImport).toHaveBeenCalledExactlyOnceWith(
      'label-a',
      'session-a',
    )
    expect(loadLabelImports).toHaveBeenCalledWith('label-a', false)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('unlinks without deleting the import and preserves the row when saving fails', async () => {
    vi.mocked(unlinkLabelImport).mockRejectedValue(new Error('offline'))
    render(<LabelImportsSection labelId="label-a" />)
    await screen.findByText('/Music/Label')
    await userEvent.click(screen.getByRole('button', { name: 'Unlink' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not update the link',
    )
    expect(
      screen.getByRole('link', { name: 'Continue import' }),
    ).toBeInTheDocument()
    expect(unlinkLabelImport).toHaveBeenCalledExactlyOnceWith(
      'label-a',
      'session-a',
    )
  })

  it('ignores a delayed response after changing labels', async () => {
    let resolveOld!: (value: ReturnType<typeof page>) => void
    vi.mocked(loadLabelImports)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve
        }),
      )
      .mockResolvedValue(page([]))
    const view = render(<LabelImportsSection key="a" labelId="label-a" />)
    view.rerender(<LabelImportsSection key="b" labelId="label-b" />)
    await screen.findByText('No linked imports yet.')
    await act(async () => {
      resolveOld(page([session]))
      await Promise.resolve()
    })
    expect(screen.queryByText('/Music/Label')).not.toBeInTheDocument()
  })

  it('retries loading after a failure', async () => {
    vi.mocked(loadLabelImports)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(page([session]))
    render(<LabelImportsSection labelId="label-a" />)
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await screen.findByText('/Music/Label')
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    )
  })
})

it('keeps the release overview compact and loads imports only when requested', async () => {
  render(
    <LabelsWorkspace
      serverBackedCatalog
      labels={[{ id: 'label-a', name: 'Label A' }]}
      releases={[]}
      ownedItems={[]}
      locationSearch="?label=label-a"
    />,
  )
  expect(loadLabelImports).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Imports' }))
  await screen.findByText('/Music/Label')
  await userEvent.click(screen.getByRole('button', { name: 'Releases' }))
  expect(screen.queryByText('/Music/Label')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Imports' }))
  await screen.findByText('/Music/Label')
  expect(loadLabelImports).toHaveBeenCalledTimes(2)
})
