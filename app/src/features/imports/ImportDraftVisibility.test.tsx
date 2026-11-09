import { describe, expect, it, vi } from 'vitest'
import * as h from '../../test/appTestHarness'
import type { ReleaseImportDraft } from '../catalog/catalogApi'
import { DraftsTable } from './ImportReviewPanels'

h.setupAppTestHooks()

function draft(
  id: string,
  status: ReleaseImportDraft['status'],
): ReleaseImportDraft {
  return {
    id,
    status,
    title: id,
    sourceKind: 'localFiles',
    sourcePath: `/example/${id}`,
    relativePath: id,
    type: 'album',
    isVariousArtists: false,
    notOnLabel: true,
    artistNames: [],
    selectedArtistIds: [],
    artistSuggestions: [],
    genres: [],
    tags: [],
    issues: [],
    tracks: [],
  }
}

const drafts = [
  draft('Ready album', 'ready'),
  draft('Review album', 'needsReview'),
  draft('Done album', 'confirmed'),
  draft('Skipped album', 'skipped'),
]

describe('import draft visibility', () => {
  it('hides only confirmed drafts and reveals them through an explicit checkbox', async () => {
    const onSelect = vi.fn()
    const user = h.userEvent.setup()
    h.render(
      <DraftsTable
        drafts={drafts}
        selectedDraftId="Ready album"
        onSelect={onSelect}
      />,
    )
    const toggle = h.screen.getByRole('checkbox', {
      name: 'Show confirmed (1)',
    })
    expect(toggle).not.toBeChecked()
    expect(h.screen.getByText('3 shown · 4 total')).toBeVisible()
    expect(
      h.screen.queryByRole('button', { name: /Done album/ }),
    ).not.toBeInTheDocument()
    expect(
      h.screen.getByRole('button', { name: /Skipped album/ }),
    ).toBeVisible()
    await user.click(toggle)
    expect(h.screen.getByText('4 shown · 4 total')).toBeVisible()
    await user.click(h.screen.getByRole('button', { name: /Done album/ }))
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('Done album')
    await user.click(toggle)
    expect(
      h.screen.queryByRole('button', { name: /Done album/ }),
    ).not.toBeInTheDocument()
    expect(drafts[2].status).toBe('confirmed')
  })

  it('explains the empty state while retaining a selected confirmed editor', () => {
    const onSelect = vi.fn()
    h.render(
      <DraftsTable
        drafts={[drafts[2]]}
        selectedDraftId="Done album"
        onSelect={onSelect}
      />,
    )
    expect(h.screen.getByText(/No unconfirmed releases/)).toBeVisible()
    expect(
      h.screen.getByText(/selected confirmed release remains open/),
    ).toBeVisible()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('removes a newly confirmed row without resetting the explicit visibility choice', async () => {
    const user = h.userEvent.setup()
    const onSelect = vi.fn()
    const view = h.render(
      <DraftsTable
        drafts={[drafts[0]]}
        selectedDraftId="Ready album"
        onSelect={onSelect}
      />,
    )
    view.rerender(
      <DraftsTable
        drafts={[draft('Ready album', 'confirmed')]}
        selectedDraftId="Ready album"
        onSelect={onSelect}
      />,
    )
    expect(
      h.screen.queryByRole('button', { name: /Ready album/ }),
    ).not.toBeInTheDocument()
    await user.click(
      h.screen.getByRole('checkbox', { name: 'Show confirmed (1)' }),
    )
    view.rerender(
      <DraftsTable
        drafts={[draft('Ready album', 'confirmed'), drafts[2]]}
        selectedDraftId="Ready album"
        onSelect={onSelect}
      />,
    )
    expect(h.screen.getByRole('button', { name: /Ready album/ })).toBeVisible()
    expect(h.screen.getByRole('button', { name: /Done album/ })).toBeVisible()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('resets visibility for another session and handles an empty session', async () => {
    const user = h.userEvent.setup()
    const view = h.render(
      <DraftsTable
        key="session-a"
        drafts={drafts}
        selectedDraftId=""
        onSelect={vi.fn()}
      />,
    )
    await user.click(
      h.screen.getByRole('checkbox', { name: 'Show confirmed (1)' }),
    )
    view.rerender(
      <DraftsTable
        key="session-b"
        drafts={drafts}
        selectedDraftId=""
        onSelect={vi.fn()}
      />,
    )
    expect(
      h.screen.getByRole('checkbox', { name: 'Show confirmed (1)' }),
    ).not.toBeChecked()
    view.rerender(
      <DraftsTable
        key="empty"
        drafts={[]}
        selectedDraftId=""
        onSelect={vi.fn()}
      />,
    )
    expect(
      h.screen.getByText('No release drafts in this session.'),
    ).toBeVisible()
    expect(h.screen.getByText('0 shown · 0 total')).toBeVisible()
  })
})
