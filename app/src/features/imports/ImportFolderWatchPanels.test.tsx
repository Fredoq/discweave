import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  DraftDiskChangesPanel,
  DraftWatchBadges,
  WatchedFoldersPanel,
} from './ImportFolderWatchPanels'
import type { DraftDiskChanges } from './folderWatchDiff'
import type { WatchedFolderState } from './folderWatchStore'

const root = '/music'

const catalogChanges: DraftDiskChanges = {
  key: 'release-1',
  title: 'Album A',
  inCatalog: true,
  signature: 'signature',
  scanPaths: ['/music/A/01 New.flac'],
  changes: [
    {
      kind: 'renamed',
      path: '/music/A/01 New.flac',
      previousPath: '/music/A/01.flac',
      localAudioFileId: 'file-1',
    },
    { kind: 'missing', path: '/music/A/02.flac', localAudioFileId: 'file-2' },
  ],
}

const draftChanges: DraftDiskChanges = {
  ...catalogChanges,
  key: 'draft-1',
  inCatalog: false,
}

function watchedFolder(
  overrides: Partial<WatchedFolderState> = {},
): WatchedFolderState {
  return {
    sourceRoot: root,
    sessionId: 'session-1',
    status: 'idle',
    error: null,
    lastCheckedAt: null,
    newDraftIds: ['draft-2'],
    changes: [catalogChanges, draftChanges],
    ...overrides,
  }
}

function renderFolders(folder: WatchedFolderState | null) {
  const handlers = {
    onApply: vi.fn(),
    onCheckNow: vi.fn(),
    onDismiss: vi.fn(),
    onOpenImport: vi.fn(),
    onRemoveFolder: vi.fn(),
  }
  render(
    <WatchedFoldersPanel
      pendingAction={null}
      watch={folder ? { [root]: folder } : {}}
      {...handlers}
    />,
  )
  return handlers
}

describe('import folder watch panels', () => {
  it('stays hidden while no folder is watched', () => {
    renderFolders(null)

    expect(screen.queryByText('Watched folders')).not.toBeInTheDocument()
  })

  it('shows a watched folder with its counters and folder actions', async () => {
    const user = userEvent.setup()
    const handlers = renderFolders(watchedFolder())

    expect(screen.getByText(root)).toBeInTheDocument()
    expect(screen.getByText('1 new')).toBeInTheDocument()
    expect(screen.getByText('2 changed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Check now' }))
    await user.click(screen.getByRole('button', { name: 'Open import' }))
    await user.click(screen.getByRole('button', { name: 'Stop watching' }))
    expect(handlers.onCheckNow).toHaveBeenCalledWith(root)
    expect(handlers.onOpenImport).toHaveBeenCalledWith('session-1')
    expect(handlers.onRemoveFolder).toHaveBeenCalledWith(root)
  })

  it('lists catalog release changes and applies or dismisses them only on request', async () => {
    const user = userEvent.setup()
    const handlers = renderFolders(watchedFolder())

    await user.click(screen.getByText('Album A'))
    expect(screen.getByText('A/01.flac → A/01 New.flac')).toBeInTheDocument()
    expect(
      screen.getByText('Missing files are only flagged. Nothing is deleted.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Apply to catalog' }))
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(handlers.onApply).toHaveBeenCalledWith(root, 'release-1')
    expect(handlers.onDismiss).toHaveBeenCalledWith(root, 'release-1')
  })

  it('reports a failed check', () => {
    renderFolders(
      watchedFolder({ status: 'error', error: 'Folder is offline' }),
    )

    expect(
      screen.getByText('Check failed: Folder is offline'),
    ).toBeInTheDocument()
  })

  it('marks new and changed drafts', () => {
    const { container, rerender } = render(
      <DraftWatchBadges draftId="draft-1" folder={watchedFolder()} />,
    )
    expect(screen.getByText('Changed on disk')).toBeInTheDocument()

    rerender(<DraftWatchBadges draftId="draft-2" folder={watchedFolder()} />)
    expect(screen.getByText('New')).toBeInTheDocument()

    rerender(<DraftWatchBadges draftId="draft-3" folder={watchedFolder()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('offers to recreate a changed draft unless every file is missing', async () => {
    const user = userEvent.setup()
    const onRecreate = vi.fn()
    const { rerender } = render(
      <DraftDiskChangesPanel
        changes={draftChanges}
        pendingAction={null}
        sourceRoot={root}
        onRecreate={onRecreate}
      />,
    )

    expect(
      screen.getByText('Your edits in this draft will be lost.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Recreate draft' }))
    expect(onRecreate).toHaveBeenCalledWith(root, 'draft-1')

    rerender(
      <DraftDiskChangesPanel
        changes={{ ...draftChanges, scanPaths: [] }}
        pendingAction={null}
        sourceRoot={root}
        onRecreate={onRecreate}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Recreate draft' }),
    ).toBeDisabled()
  })
})
