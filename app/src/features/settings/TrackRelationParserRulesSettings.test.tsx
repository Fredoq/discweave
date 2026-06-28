import { describe, expect, it } from 'vitest'
import * as h from '../../test/appTestHarness'
import { TrackRelationParserRulesSettings } from './TrackRelationParserRulesSettings'

h.setupAppTestHooks()

describe('TrackRelationParserRulesSettings', () => {
  it('renders and saves active parser rules beside dictionary relation type names', async () => {
    h.seedCatalogForTests({
      artists: [],
      labels: [],
      releases: [],
      tracks: [],
      ownedItems: [],
      relations: [],
      playlists: [],
      trackRelationParserRules: [
        {
          id: 'parser-rule-radio-edit',
          alias: 'Radio Edit',
          relationTypeCode: 'versionOf',
          matchMode: 'exactLastParentheticalToken',
          confidence: 92,
          direction: 'variantToBase',
          sortOrder: 10,
          isActive: true,
          isBuiltin: false,
        },
      ],
    })

    const user = h.userEvent.setup()
    h.render(
      <TrackRelationParserRulesSettings
        dictionaries={h.defaultCatalogDictionaries}
        onModeChange={() => undefined}
      />,
    )

    expect(
      await h.screen.findByRole('heading', {
        name: 'Track relation parser rules',
      }),
    ).toBeVisible()
    expect(h.screen.getByDisplayValue('Radio Edit')).toBeVisible()
    expect(
      h.screen.getByRole('combobox', {
        name: 'Relation type for Radio Edit',
      }),
    ).toHaveValue('versionOf')

    const ruleRow = h.screen.getByDisplayValue('Radio Edit').closest('tr')
    if (!ruleRow) {
      throw new Error('Expected parser rule row to render')
    }

    expect(
      h.within(ruleRow).getByLabelText('Alias for Radio Edit'),
    ).toHaveValue('Radio Edit')
    await user.clear(
      h.within(ruleRow).getByLabelText('Confidence for Radio Edit'),
    )
    await user.type(
      h.within(ruleRow).getByLabelText('Confidence for Radio Edit'),
      '88',
    )
    await user.clear(
      h.within(ruleRow).getByLabelText('Sort order for Radio Edit'),
    )
    await user.type(
      h.within(ruleRow).getByLabelText('Sort order for Radio Edit'),
      '25',
    )
    await user.click(
      h.within(ruleRow).getByRole('button', {
        name: 'Save parser rule Radio Edit',
      }),
    )

    await h.waitFor(() => {
      expect(
        h.screen.getAllByText('Parser rule updated').length,
      ).toBeGreaterThan(0)
    })

    const confirm = h.vi.spyOn(window, 'confirm').mockReturnValue(true)

    await user.click(
      h.within(ruleRow).getByRole('button', {
        name: 'Delete parser rule Radio Edit',
      }),
    )

    expect(confirm).toHaveBeenCalledWith(
      'Delete the track relation parser rule "Radio Edit"? This cannot be undone.',
    )
    await h.waitFor(() => {
      expect(
        h.screen.getAllByText('Parser rule deleted').length,
      ).toBeGreaterThan(0)
    })
  })
})
