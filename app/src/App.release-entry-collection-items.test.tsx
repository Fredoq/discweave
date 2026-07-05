import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App release entry collection items', () => {
  it('adds a wanted digital collection item and filters releases by status and medium', async () => {
    window.history.pushState({}, '', '/releases')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })

    expect(
      h.within(form).getByRole('heading', { name: 'Collection items' }),
    ).toBeVisible()
    expect(h.within(form).queryByText('Owned copy')).not.toBeInTheDocument()
    expect(h.within(form).queryByText('Add owned copy')).not.toBeInTheDocument()

    await user.type(
      h.within(form).getByLabelText('Title'),
      'Wanted Digital Target',
    )
    await h.addReleaseArtist(user, form, 'Autechre')
    await user.click(h.within(form).getByLabelText('Not On Label'))
    await h.selectReleaseGenre(user, form, 'Electronic')
    await h.addReleaseTrackRow(user, form, 'Wanted Mix')
    await user.click(h.within(form).getByRole('button', { name: '+ Item' }))
    await user.selectOptions(
      h.within(form).getByLabelText('Collection item 1 status'),
      'Wanted',
    )
    await user.selectOptions(
      h.within(form).getByLabelText('Collection item 1 medium'),
      'Digital',
    )
    await user.type(
      h.within(form).getByLabelText('Collection item 1 note'),
      'Find lossless digital version',
    )

    await user.click(h.screen.getByRole('button', { name: 'Add record' }))
    await user.click(
      await h.screen.findByRole('button', {
        name: /wanted digital target/i,
      }),
    )

    const releasePanel = h.screen.getByRole('complementary', {
      name: 'Wanted Digital Target',
    })
    const collectionItems = h.detailSection(releasePanel, 'Collection items')
    expect(collectionItems).toHaveTextContent('Wanted')
    expect(collectionItems).toHaveTextContent('Digital')
    expect(collectionItems).toHaveTextContent('Find lossless digital version')
    expect(
      h.within(releasePanel).queryByRole('heading', { name: 'Owned copies' }),
    ).not.toBeInTheDocument()

    await user.selectOptions(
      h.screen.getByLabelText('Ownership status'),
      'Wanted',
    )
    await user.selectOptions(h.screen.getByLabelText('Medium'), 'Digital')

    expect(
      h.screen.getByRole('button', { name: /wanted digital target/i }),
    ).toBeVisible()
  })
})
