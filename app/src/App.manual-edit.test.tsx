import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App manual edit flows', () => {
  it('keeps label add and edit forms exclusive', async () => {
    window.history.pushState({}, '', '/labels')
    h.seedCatalogForTests({
      artists: h.artistRecords,
      labels: [{ id: 'label-factory', name: 'Factory' }],
      releases: h.releaseRecords,
      tracks: h.trackRecords,
      ownedItems: h.ownedItemRecords,
      relations: h.relationRecords,
      playlists: h.playlistRecords,
    })
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add label' }))

    const addForm = h.screen.getByRole('form', { name: 'Add label' })
    expect(h.within(addForm).getByLabelText('Name')).toHaveFocus()

    await user.click(h.screen.getByRole('button', { name: 'Edit record' }))

    expect(
      h.screen.queryByRole('form', { name: 'Add label' }),
    ).not.toBeInTheDocument()
    const editForm = h.screen.getByRole('form', { name: 'Edit label' })
    expect(h.within(editForm).getByLabelText('Name')).toHaveFocus()

    await user.click(h.within(editForm).getByRole('button', { name: 'Cancel' }))

    expect(
      h.screen.queryByRole('form', { name: 'Add label' }),
    ).not.toBeInTheDocument()
    expect(
      h.screen.queryByRole('form', { name: 'Edit label' }),
    ).not.toBeInTheDocument()
  })

  it('keeps manually entered tracks unlinked until a real release is selected', async () => {
    window.history.pushState({}, '', '/tracks')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add track' }))
    const form = h.screen.getByRole('form', { name: 'Add track' })

    await user.type(h.within(form).getByLabelText('Title'), 'Desk Tape Index')
    await user.click(h.screen.getByRole('button', { name: 'Add record' }))

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Desk Tape Index',
    })
    const linkedReleaseSection = h.detailSection(
      detailPanel,
      'Release appearances',
    )

    expect(
      h
        .within(linkedReleaseSection)
        .getByText('No release appearances recorded.'),
    ).toBeInTheDocument()
    expect(
      h.within(linkedReleaseSection).queryByRole('link', {
        name: 'Unlinked release',
      }),
    ).not.toBeInTheDocument()
  })

  it('keeps owned item entry blocked until a real catalog target is selected', async () => {
    window.history.pushState({}, '', '/owned-items')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add owned item' }))
    const form = h.screen.getByRole('form', { name: 'Add owned item' })

    await user.type(
      h.within(form).getByLabelText('Item name'),
      'Dubplate Sleeve Note',
    )

    expect(h.within(form).getByRole('alert')).toHaveTextContent(
      'Select an existing release.',
    )
    expect(
      h.within(form).getByRole('button', { name: 'Add record' }),
    ).toBeDisabled()
  })

  it('edits a manual artist and updates the current row and detail', async () => {
    window.history.pushState({}, '', '/artists')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await h.addManualArtist(user, 'Session Draft Artist')

    expect(h.screen.getByText('Editable collection record')).toBeVisible()

    await user.click(h.screen.getByRole('button', { name: 'Edit record' }))
    const form = h.screen.getByRole('form', { name: 'Edit artist' })
    await user.clear(h.within(form).getByLabelText('Name'))
    await user.type(
      h.within(form).getByLabelText('Name'),
      'Session Edited Artist',
    )
    await user.click(
      h.within(form).getByRole('button', { name: 'Save record' }),
    )

    expect(
      h.screen.getByRole('button', { name: /session edited artist/i }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(
      h.screen.queryByRole('button', { name: /session draft artist/i }),
    ).not.toBeInTheDocument()
    expect(
      h.screen.getByRole('complementary', { name: 'Session Edited Artist' }),
    ).toBeInTheDocument()
  })

  it('edits manual records and updates catalog rows immediately', async () => {
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('link', { name: 'Artists' }))
    await h.addManualArtist(user, 'Catalog Session Artist')
    await user.click(h.screen.getByRole('button', { name: 'Edit record' }))
    let form = h.screen.getByRole('form', { name: 'Edit artist' })
    await user.clear(h.within(form).getByLabelText('Name'))
    await user.type(
      h.within(form).getByLabelText('Name'),
      'Catalog Edited Artist',
    )
    await user.click(
      h.within(form).getByRole('button', { name: 'Save record' }),
    )

    await user.click(h.screen.getByRole('link', { name: 'Catalog' }))
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search collection' }),
      'Catalog Edited Artist',
    )

    expect(
      h.screen.getByRole('row', { name: /catalog edited artist/i }),
    ).toBeVisible()
    expect(
      h.screen.queryByRole('row', { name: /catalog session artist/i }),
    ).not.toBeInTheDocument()

    await user.click(h.screen.getByRole('link', { name: 'Releases' }))
    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    form = h.screen.getByRole('form', { name: 'Add release' })
    await user.type(
      h.within(form).getByLabelText('Title'),
      'Catalog Session EP',
    )
    await h.addReleaseArtist(user, form, 'Catalog Edited Artist')
    await h.addReleaseLabel(user, form)
    await h.selectReleaseGenre(user, form)
    await h.addReleaseTrackRow(user, form)
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))
    await user.click(h.screen.getByRole('button', { name: 'Edit record' }))
    form = h.screen.getByRole('form', { name: 'Edit release' })
    await user.clear(h.within(form).getByLabelText('Title'))
    await user.type(h.within(form).getByLabelText('Title'), 'Catalog Edited EP')
    await user.click(
      h.within(form).getByRole('button', { name: 'Save record' }),
    )

    await user.click(h.screen.getByRole('link', { name: 'Catalog' }))
    await user.clear(
      h.screen.getByRole('searchbox', { name: 'Search collection' }),
    )
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search collection' }),
      'Catalog Edited EP',
    )

    expect(
      h.screen.getByRole('row', { name: /catalog edited ep/i }),
    ).toBeVisible()
    expect(
      h.screen.queryByRole('row', { name: /catalog session ep/i }),
    ).not.toBeInTheDocument()
  })

  it('keeps artist appearances current when a linked manual artist is edited', async () => {
    window.history.pushState({}, '', '/artists')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await h.addManualArtist(user, 'Backlink Session Artist')
    await user.click(h.screen.getByRole('link', { name: 'Releases' }))
    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const releaseForm = h.screen.getByRole('form', { name: 'Add release' })
    await user.type(
      h.within(releaseForm).getByLabelText('Title'),
      'Backlink EP',
    )
    await h.addReleaseArtist(user, releaseForm, 'Backlink Session Artist')
    await h.addReleaseLabel(user, releaseForm)
    await h.selectReleaseGenre(user, releaseForm)
    await h.addReleaseTrackRow(user, releaseForm)
    await user.click(
      h.within(releaseForm).getByRole('button', { name: 'Add record' }),
    )

    await user.click(h.screen.getByRole('link', { name: 'Artists' }))
    await user.click(
      h.screen.getByRole('button', { name: /backlink session artist/i }),
    )
    await user.click(h.screen.getByRole('button', { name: 'Edit record' }))
    const artistForm = h.screen.getByRole('form', { name: 'Edit artist' })
    await user.clear(h.within(artistForm).getByLabelText('Name'))
    await user.type(
      h.within(artistForm).getByLabelText('Name'),
      'Backlink Edited Artist',
    )
    await user.click(
      h.within(artistForm).getByRole('button', { name: 'Save record' }),
    )

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Backlink Edited Artist',
    })
    expect(
      h
        .within(h.detailSection(detailPanel, 'Credit appearances'))
        .getByRole('link', {
          name: 'Backlink EP',
        }),
    ).toHaveAttribute(
      'href',
      expect.stringContaining('/releases?release=manual-release-backlink-ep-'),
    )

    await user.click(h.screen.getByRole('link', { name: 'Releases' }))
    await user.click(h.screen.getByRole('button', { name: /backlink ep/i }))
    const releaseDetail = h.screen.getByRole('complementary', {
      name: 'Backlink EP',
    })
    expect(
      h
        .within(h.detailSection(releaseDetail, 'Release metadata'))
        .getByText('Backlink Edited Artist'),
    ).toBeInTheDocument()
  })

  it('exposes edit controls for backend catalog records', () => {
    window.history.pushState({}, '', '/artists?artist=aphex-twin')

    h.render(<h.App />)

    expect(
      h.screen.getByRole('complementary', { name: 'Aphex Twin' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('button', { name: 'Edit record' }),
    ).toBeInTheDocument()
    expect(h.screen.getByText('Editable collection record')).toBeInTheDocument()
    expect(
      h.screen.getByRole('button', { name: /delete record/i }),
    ).toBeInTheDocument()
  })

  it.each(['/imports', '/exports'])(
    'keeps manual session edit controls out of %s',
    (path) => {
      window.history.pushState({}, '', path)

      h.render(<h.App />)

      expect(
        h.screen.queryByRole('button', { name: 'Edit record' }),
      ).not.toBeInTheDocument()
      expect(
        h.screen.queryByRole('form', { name: /edit/i }),
      ).not.toBeInTheDocument()
      expect(
        h.screen.queryByText('Editable collection record'),
      ).not.toBeInTheDocument()
      expect(
        h.screen.queryByRole('button', { name: /delete record/i }),
      ).not.toBeInTheDocument()
    },
  )
})
