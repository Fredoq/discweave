import { describe, expect, it, vi } from 'vitest'
import * as h from '../../test/appTestHarness'
import type { ImportRelationSuggestion } from '../catalog/catalogApi'
import { ImportRelationSuggestionsPanel } from './ImportRelationSuggestionsPanel'

h.setupAppTestHooks()

describe('relation suggestion identity', () => {
  it('identifies catalog targets without loading the catalog and updates the reviewed direction', async () => {
    const source = {
      kind: 'draftTrack' as const,
      id: 'draft-source',
      title: 'Open Your Eyes (Original Mix)',
      artistDisplay: 'Mira Vale',
      versionYear: 2004,
    }
    const target = {
      kind: 'existingTrack' as const,
      id: 'catalog-target',
      title: 'Open Your Eyes',
      artistDisplay: 'Mira Vale',
      versionYear: 2004,
    }
    const alternative = {
      ...target,
      kind: 'draftTrack' as const,
      id: 'draft-target',
    }
    const reviewed = { source, target, relationTypeCode: 'remixOf' }
    const suggestion: ImportRelationSuggestion = {
      id: 'suggestion',
      draftId: 'draft',
      token: 'Original Mix',
      confidence: 95,
      decision: 'pending',
      applicationMode: 'bestEffort',
      isModified: false,
      suggested: reviewed,
      reviewed,
      targetOptions: [target, alternative],
    }
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const user = h.userEvent.setup()
    h.render(
      <ImportRelationSuggestionsPanel
        suggestions={[suggestion]}
        relationTypeOptions={[
          {
            id: 'remix',
            kind: 'trackRelationType',
            code: 'remixOf',
            name: 'Remix of',
            sortOrder: 0,
            isActive: true,
            isBuiltin: true,
            isProtected: true,
          },
          {
            id: 'version',
            kind: 'trackRelationType',
            code: 'versionOf',
            name: 'Version of',
            sortOrder: 1,
            isActive: true,
            isBuiltin: true,
            isProtected: true,
          },
        ]}
        onUpdate={onUpdate}
      />,
    )

    expect(
      h.screen.getByRole('option', {
        name: 'Open Your Eyes — Mira Vale · 2004 · In collection',
      }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByText('Open Your Eyes', { selector: 'strong' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByText('In collection', { selector: 'span' }),
    ).toBeInTheDocument()
    expect(h.screen.queryByText(/catalog-target/)).not.toBeInTheDocument()
    await user.selectOptions(
      h.screen.getByLabelText('Target for Original Mix'),
      'draftTrack:draft-target',
    )
    await user.selectOptions(
      h.screen.getByLabelText('Relation type for Original Mix'),
      'versionOf',
    )
    expect(
      h.screen.getByText('In this import', { selector: 'span' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByText(
        'Open Your Eyes (Original Mix) → Version of → Open Your Eyes',
      ),
    ).toBeInTheDocument()
    await user.click(
      h.screen.getByRole('button', { name: /Accept relation suggestion/ }),
    )
    expect(onUpdate).toHaveBeenCalledWith('suggestion', 'accepted', {
      source,
      target: alternative,
      relationTypeCode: 'versionOf',
    })
  })

  it('shows a readable fallback when track metadata is unavailable', () => {
    const source = { kind: 'draftTrack' as const, id: 'source' }
    const target = { kind: 'existingTrack' as const, id: 'unavailable-id' }
    const reviewed = { source, target, relationTypeCode: 'remixOf' }
    h.render(
      <ImportRelationSuggestionsPanel
        suggestions={[
          {
            id: 'suggestion',
            draftId: 'draft',
            token: 'Mix',
            confidence: 90,
            decision: 'pending',
            applicationMode: 'bestEffort',
            isModified: false,
            suggested: reviewed,
            reviewed,
            targetOptions: [target],
          },
        ]}
        relationTypeOptions={[]}
        onUpdate={vi.fn()}
      />,
    )
    expect(
      h.screen.getByRole('option', {
        name: 'Track unavailable — Artist unknown · In collection',
      }),
    ).toBeInTheDocument()
    expect(h.screen.queryByText(/unavailab-/)).not.toBeInTheDocument()
  })
})
