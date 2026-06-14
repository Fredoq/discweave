import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App settings and navigation', () => {
  it('renders the settings workspace with dictionary rows and selected detail', () => {
    window.history.pushState({}, '', '/settings')

    h.render(<h.App />)

    expect(
      h.screen.getByRole('region', { name: 'Settings workspace' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('searchbox', { name: 'Search settings' }),
    ).toBeVisible()
    expect(
      h.screen.getByRole('row', {
        name: /unknownrelease types unknown 0 active/i,
      }),
    ).toBeVisible()
    expect(
      h.screen.getByRole('row', {
        name: /albumrelease types album 10 active/i,
      }),
    ).toBeVisible()
    expect(
      h.screen.getByRole('complementary', { name: 'Unknown' }),
    ).toBeInTheDocument()
  })

  it('filters dictionary settings by kind, name, code, status and media profile', async () => {
    window.history.pushState({}, '', '/settings')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.selectOptions(h.screen.getByLabelText('Dictionary'), 'genre')
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search settings' }),
      'ambient active',
    )

    expect(
      h.screen.getByRole('row', { name: /ambientgenres ambient 10 active/i }),
    ).toBeVisible()
    expect(
      h.screen.queryByRole('row', { name: /electronicgenres/i }),
    ).not.toBeInTheDocument()

    await user.clear(
      h.screen.getByRole('searchbox', { name: 'Search settings' }),
    )
    await user.selectOptions(h.screen.getByLabelText('Dictionary'), 'mediaType')
    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search settings' }),
      'digital builtin',
    )

    expect(
      h.screen.getByRole('row', {
        name: /digitalmedia types digital 10 active/i,
      }),
    ).toBeVisible()
    expect(
      h.screen.queryByRole('row', { name: /vinylmedia types/i }),
    ).not.toBeInTheDocument()
  })

  it('updates dictionary detail when an entry row is selected and saved', async () => {
    window.history.pushState({}, '', '/settings')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(
      h
        .within(
          h.screen.getByRole('row', {
            name: /albumrelease types album 10 active/i,
          }),
        )
        .getByRole('button'),
    )

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Album',
    })
    await user.clear(h.within(detailPanel).getByLabelText('Name'))
    await user.type(h.within(detailPanel).getByLabelText('Name'), 'Long player')
    await user.clear(h.within(detailPanel).getByLabelText('Order'))
    await user.type(h.within(detailPanel).getByLabelText('Order'), '11')
    await user.click(
      h.within(detailPanel).getByRole('button', { name: 'Save' }),
    )

    expect(
      await h.screen.findByRole('row', {
        name: /long playerrelease types album 11 active/i,
      }),
    ).toBeVisible()
  })

  it('shows all required dictionary editor controls', () => {
    window.history.pushState({}, '', '/settings')

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Unknown',
    })

    expect(
      h.screen.getByLabelText('Dictionary entry editor'),
    ).toBeInTheDocument()
    expect(
      h.screen.getByLabelText('Dictionary entry removal'),
    ).toBeInTheDocument()
    expect(h.within(detailPanel).getByLabelText('Name')).toBeInTheDocument()
    expect(h.within(detailPanel).getByLabelText('Order')).toBeInTheDocument()
    expect(h.within(detailPanel).getByLabelText('Active')).toBeDisabled()
    expect(
      h.within(detailPanel).getByRole('button', { name: 'Save' }),
    ).toBeEnabled()
    expect(
      h.within(detailPanel).getByRole('button', { name: 'Delete' }),
    ).toBeDisabled()
    expect(h.within(detailPanel).getByLabelText('Replacement')).toBeDisabled()
    expect(
      h.within(detailPanel).getByRole('button', { name: 'Replace usages' }),
    ).toBeDisabled()
  })

  it('creates dictionary entries from the settings workspace', async () => {
    window.history.pushState({}, '', '/settings')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.selectOptions(h.screen.getByLabelText('Dictionary'), 'genre')
    const addPanel = h.screen.getByRole('region', {
      name: 'Add dictionary entry',
    })
    await user.type(h.within(addPanel).getByLabelText('Code'), 'dub')
    await user.type(h.within(addPanel).getByLabelText('Name'), 'Dub')
    await user.clear(h.within(addPanel).getByLabelText('Order'))
    await user.type(h.within(addPanel).getByLabelText('Order'), '90')
    const addButton = h.within(addPanel).getByRole('button', { name: 'Add' })
    expect(addButton).toBeEnabled()
    await user.click(addButton)

    expect(
      await h.screen.findByRole('row', { name: /dubgenres dub 90 active/i }),
    ).toBeVisible()
  })

  it('shows naming profile settings beside dictionary and import settings', async () => {
    window.history.pushState({}, '', '/settings')
    const user = h.userEvent.setup()
    const fetchMock = h.mockFetch(
      h.jsonResponse({
        items: [
          {
            id: 'profile-default',
            name: 'DiscWeave default',
            releaseFolderTemplate:
              '[{catalogNumber}, {releaseDate}] {releaseArtists} - {title}',
            trackFileTemplate: '{position2} {title}',
            trackFileWithArtistTemplate: '{position2} {trackArtists} - {title}',
            sortOrder: 10,
            isDefault: true,
            isActive: true,
            isBuiltin: true,
          },
          {
            id: 'profile-web-flac',
            name: 'WEB FLAC 24-bit',
            releaseFolderTemplate:
              '{releaseArtists} - {title} ({year}) [{source} {format} {bitDepth}]',
            trackFileTemplate: '{position2} {title}',
            trackFileWithArtistTemplate: '{position2} {trackArtists} - {title}',
            sortOrder: 50,
            isDefault: false,
            isActive: true,
            isBuiltin: false,
          },
        ],
        limit: 100,
        offset: 0,
        total: 2,
      }),
    )
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Naming profiles' }))

    expect(
      await h.screen.findByRole('region', {
        name: 'Naming profile settings',
      }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('row', { name: /discweave default/i }),
    ).toBeVisible()
    expect(
      h.screen.getByRole('row', { name: /web flac 24-bit/i }),
    ).toBeVisible()
    expect(h.screen.getByLabelText('Release folder template')).toHaveValue(
      '[{catalogNumber}, {releaseDate}] {releaseArtists} - {title}',
    )
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/settings/naming-profiles?limit=100&offset=0',
      {
        credentials: 'include',
        method: 'GET',
      },
    )
  })

  it('shows tag role mapping settings beside other settings modes', async () => {
    window.history.pushState({}, '', '/settings')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Tag mappings' }))

    expect(
      await h.screen.findByRole('region', { name: 'Tag mapping settings' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('row', {
        name: /producerproducer producer standard field/i,
      }),
    ).toBeVisible()
    expect(h.screen.getByLabelText('Tag mapping scope')).toHaveTextContent(
      'Maps DiscWeave artist credit roles to embedded audio tag fields.',
    )
    await user.click(
      h
        .within(
          h.screen.getByRole('row', {
            name: /producerproducer producer standard field/i,
          }),
        )
        .getByRole('button'),
    )
    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Producer',
    })
    expect(h.within(detailPanel).getByLabelText('Artist role')).toHaveValue(
      'producer',
    )
    expect(
      h.within(detailPanel).getByLabelText('Standard tag field'),
    ).toHaveValue('producer')
    expect(
      Array.from(
        h
          .within(detailPanel)
          .getByLabelText('Standard tag field')
          .querySelectorAll('option'),
      ).map((option) => option.textContent),
    ).toEqual(['Composer', 'Producer', 'Remixer'])
    expect(h.within(detailPanel).queryByText('Lyricist')).toBeNull()
    expect(
      h.within(detailPanel).getByText(/normalized producer tag/i),
    ).toBeVisible()

    await user.selectOptions(
      h.within(detailPanel).getByLabelText('Standard tag field'),
      'remixer',
    )

    expect(
      h.within(detailPanel).getByText(/normalized remixer tag/i),
    ).toBeVisible()

    await user.selectOptions(
      h.within(detailPanel).getByLabelText('Standard tag field'),
      'composer',
    )

    expect(
      h.within(detailPanel).getByText(/normalized composer tag/i),
    ).toBeVisible()
  })

  it('saves and removes the redacted Discogs token from integration settings', async () => {
    window.history.pushState({}, '', '/settings')
    h.seedDiscogsIntegrationForTests({ configured: false })
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Integrations' }))

    expect(
      await h.screen.findByRole('region', {
        name: 'Discogs integration settings',
      }),
    ).toBeInTheDocument()
    expect(h.screen.getByText('Discogs not configured')).toBeVisible()
    expect(
      h.screen.getByText('Unavailable until token is saved.'),
    ).toBeVisible()

    await user.type(
      h.screen.getByLabelText('Discogs personal access token'),
      'local-discogs-token',
    )
    await user.click(h.screen.getByRole('button', { name: 'Save token' }))

    expect(await h.screen.findByText('Discogs configured')).toBeVisible()
    expect(
      h.screen.getByLabelText('Discogs personal access token'),
    ).toHaveValue('')
    expect(h.screen.queryByText('local-discogs-token')).not.toBeInTheDocument()

    await user.click(h.screen.getByRole('button', { name: 'Remove token' }))

    expect(await h.screen.findByText('Discogs not configured')).toBeVisible()
  })

  it('disables release Discogs update when the integration token is missing', () => {
    window.history.pushState({}, '', '/releases')
    h.seedDiscogsIntegrationForTests({ configured: false })

    h.render(<h.App />)

    expect(
      h.screen.getByRole('button', { name: 'Update via Discogs' }),
    ).toBeDisabled()
    expect(
      h.screen.getByText(
        'Add a Discogs token in Settings to use Discogs lookup.',
      ),
    ).toBeVisible()
  })

  it('uses a saved Discogs token as the integration switch even when the deprecated enabled flag is false', async () => {
    window.history.pushState({}, '', '/settings')
    h.seedDiscogsIntegrationForTests({ configured: true, enabled: false })
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Integrations' }))

    expect(await h.screen.findByText('Discogs configured')).toBeVisible()
    expect(h.screen.getByText('Available')).toBeVisible()
    expect(
      h.screen.queryByText(/integration is disabled/i),
    ).not.toBeInTheDocument()
    expect(h.screen.getByText('Update via Discogs')).toBeVisible()
  })

  it('keeps collection-level dangerous settings actions unavailable', () => {
    window.history.pushState({}, '', '/settings')
    h.render(<h.App />)

    expect(
      h.screen.queryByRole('button', { name: 'Delete collection' }),
    ).not.toBeInTheDocument()
    expect(
      h.screen.queryByRole('button', { name: 'Reset settings' }),
    ).not.toBeInTheDocument()
    expect(
      h
        .within(h.screen.getByLabelText('Dictionary entry removal'))
        .getByRole('button', { name: 'Delete' }),
    ).toBeDisabled()
    expect(h.screen.queryByLabelText(/confirmation/i)).not.toBeInTheDocument()
    expect(
      h.screen.getByRole('row', { name: /unknownrelease types/i }),
    ).toBeInTheDocument()
  })

  it('exposes the workspace header as a banner landmark', async () => {
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('link', { name: 'Settings' }))

    expect(
      h.within(h.screen.getByRole('banner')).getByText('Default collection'),
    ).toBeInTheDocument()
    expect(
      h.within(h.screen.getByRole('banner')).getByRole('heading', {
        name: 'Settings',
      }),
    ).toBeInTheDocument()
  })

  it('keeps sidebar and header behavior when navigating to settings', async () => {
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('link', { name: 'Settings' }))

    expect(
      h.screen.getByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument()
    expect(
      h.within(h.screen.getByRole('banner')).getByText('Default collection'),
    ).toBeInTheDocument()
    expect(h.screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      h.within(h.screen.getByRole('banner')).queryByRole('button'),
    ).not.toBeInTheDocument()
  })
})
