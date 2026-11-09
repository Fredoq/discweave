import { describe, expect, it, vi } from 'vitest'
import * as h from '../../test/appTestHarness'
import type { ImportRelationSuggestion } from '../catalog/catalogApi'
import { ImportRelationSuggestionsPanel } from './ImportRelationSuggestionsPanel'
import { ImportRelationSuggestionsSummary } from './ImportRelationSuggestionsSummary'

h.setupAppTestHooks()

function suggestion(
  id: string,
  decision: ImportRelationSuggestion['decision'],
): ImportRelationSuggestion {
  const reviewed = {
    source: {
      kind: 'draftTrack' as const,
      id: `source-${id}`,
      title: `Source ${id}`,
    },
    target: {
      kind: 'existingTrack' as const,
      id: `target-${id}`,
      title: `Target ${id}`,
    },
    relationTypeCode: 'remixOf',
  }
  return {
    id,
    draftId: 'draft',
    token: id,
    confidence: 90,
    decision,
    applicationMode: 'bestEffort',
    isModified: false,
    suggested: reviewed,
    reviewed,
    targetOptions: [reviewed.target],
  }
}

const suggestions = [
  suggestion('new', 'pending'),
  suggestion('yes', 'accepted'),
  suggestion('no', 'rejected'),
]

describe('import relation review focus', () => {
  it('shows pending suggestions first and keeps reviewed actions in collapsed history', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const user = h.userEvent.setup()
    h.render(
      <ImportRelationSuggestionsPanel
        suggestions={suggestions}
        relationTypeOptions={[]}
        onUpdate={onUpdate}
      />,
    )
    expect(
      h.screen.getByRole('table', { name: 'Pending relation suggestions' }),
    ).toBeVisible()
    expect(
      h.screen.getByRole('table', { name: 'Reviewed relation suggestions' }),
    ).not.toBeVisible()
    await user.click(h.screen.getByText('Reviewed suggestions (2)'))
    expect(
      h.screen.getByRole('table', { name: 'Reviewed relation suggestions' }),
    ).toBeVisible()
    await user.click(
      h.screen.getByRole('button', {
        name: 'Accept relation suggestion no Source no',
      }),
    )
    expect(onUpdate).toHaveBeenCalledWith(
      'no',
      'accepted',
      suggestions[2].reviewed,
    )
    await user.click(h.screen.getByText('Reviewed suggestions (2)'))
    expect(
      h.screen.getByRole('table', { name: 'Reviewed relation suggestions' }),
    ).not.toBeVisible()
  })

  it('moves a resolved suggestion out of the pending list without losing history', () => {
    const props = { relationTypeOptions: [], onUpdate: vi.fn() }
    const view = h.render(
      <ImportRelationSuggestionsPanel
        {...props}
        suggestions={[suggestions[0]]}
      />,
    )
    view.rerender(
      <ImportRelationSuggestionsPanel
        {...props}
        suggestions={[{ ...suggestions[0], decision: 'accepted' }]}
      />,
    )
    expect(h.screen.getByText('No pending relation suggestions.')).toBeVisible()
    expect(h.screen.getByText('Reviewed suggestions (1)')).toBeVisible()
    expect(
      h.screen.getByRole('button', { name: /Accept relation suggestion/ }),
    ).not.toBeVisible()
    expect(props.onUpdate).not.toHaveBeenCalled()
  })

  it('summarizes decisions and offers navigation without changing any decision', async () => {
    const onReview = vi.fn()
    const user = h.userEvent.setup()
    h.render(
      <ImportRelationSuggestionsSummary
        suggestions={suggestions}
        onReview={onReview}
      />,
    )
    expect(
      h.screen.getByText('1 pending · 1 accepted · 1 rejected'),
    ).toBeVisible()
    expect(
      h.screen.getByText(/Optional suggestions do not block import/),
    ).toBeVisible()
    await user.click(h.screen.getByRole('button', { name: 'Review relations' }))
    expect(onReview).toHaveBeenCalledOnce()
  })

  it('does not describe required relations as optional or show an empty summary', () => {
    const view = h.render(
      <ImportRelationSuggestionsSummary
        suggestions={[{ ...suggestions[0], applicationMode: 'required' }]}
      />,
    )
    expect(
      h.screen.getByText(
        /Accepted required relations must pass import validation/,
      ),
    ).toBeVisible()
    expect(
      h.screen.queryByText(/Optional suggestions do not block import/),
    ).not.toBeInTheDocument()
    expect(h.screen.queryByRole('button')).not.toBeInTheDocument()
    view.rerender(<ImportRelationSuggestionsSummary suggestions={[]} />)
    expect(h.screen.queryByRole('region')).not.toBeInTheDocument()
  })
})
