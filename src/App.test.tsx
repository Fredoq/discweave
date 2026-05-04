import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { buildCatalogEntries } from './features/catalog/catalogGraph'
import { createManualRecordId } from './features/manualEntry/manualEntryUtils'

describe('App', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/catalog')
  })

  it('renders the catalog workspace navigation and search', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Catalog' })).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: 'Search collection' }),
    ).toBeInTheDocument()

    for (const item of [
      'Catalog',
      'Artists',
      'Releases',
      'Tracks',
      'Playlists',
      'Owned Items',
      'Relations',
      'Imports',
      'Exports',
      'Settings',
    ]) {
      expect(screen.getByRole('link', { name: item })).toBeInTheDocument()
    }
  })

  it('navigates between workspace sections from the sidebar', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: 'Artists' }))

    expect(screen.getByRole('heading', { name: 'Artists' })).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: 'Search artists' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Artists' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      screen.queryByRole('searchbox', { name: 'Search collection' }),
    ).not.toBeInTheDocument()
  })

  it('reports placeholder route actions without leaving the catalog workspace', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add entry' }))

    expect(screen.getByRole('status')).toHaveTextContent(
      'Add entry is queued for the Catalog workspace.',
    )
    expect(screen.getByRole('heading', { name: 'Catalog' })).toBeInTheDocument()
  })

  it.each([
    {
      path: '/artists',
      heading: 'Artists',
      action: 'Add artist',
      form: 'Add artist',
      requiredLabel: 'Name',
      value: 'Coil Archive Test Artist',
      searchLabel: 'Search artists',
      rowName: /coil archive test artist/i,
      detailName: 'Coil Archive Test Artist',
    },
    {
      path: '/releases',
      heading: 'Releases',
      action: 'Add release',
      form: 'Add release',
      requiredLabel: 'Title',
      value: 'Silent Dub Test Pressing',
      searchLabel: 'Search releases',
      rowName: /silent dub test pressing/i,
      detailName: 'Silent Dub Test Pressing',
    },
    {
      path: '/tracks',
      heading: 'Tracks',
      action: 'Add track',
      form: 'Add track',
      requiredLabel: 'Title',
      value: 'Unlabeled Field Recording',
      searchLabel: 'Search tracks',
      rowName: /unlabeled field recording/i,
      detailName: 'Unlabeled Field Recording',
    },
    {
      path: '/owned-items',
      heading: 'Owned Items',
      action: 'Add owned item',
      form: 'Add owned item',
      requiredLabel: 'Item name',
      value: 'Basement Tape Reference Copy',
      searchLabel: 'Search owned items',
      rowName: /basement tape reference copy/i,
      detailName: 'Basement Tape Reference Copy',
    },
    {
      path: '/relations',
      heading: 'Relations',
      action: 'Add relation',
      form: 'Add relation',
      requiredLabel: 'Source',
      secondaryRequiredLabel: 'Target',
      value: 'Archive Source Person',
      secondaryValue: 'Archive Target Project',
      searchLabel: 'Search relations',
      rowName: /archive source person archive target project/i,
      detailName: 'Archive Source Person to Archive Target Project',
    },
    {
      path: '/playlists',
      heading: 'Playlists',
      action: 'Add playlist',
      form: 'Add playlist',
      requiredLabel: 'Name',
      value: 'Untitled Crate Notes',
      searchLabel: 'Search playlists',
      rowName: /untitled crate notes/i,
      detailName: 'Untitled Crate Notes',
    },
  ])(
    'supports required-only manual entry from the header in $heading',
    async ({
      path,
      heading,
      action,
      form,
      requiredLabel,
      secondaryRequiredLabel,
      value,
      secondaryValue,
      searchLabel,
      rowName,
      detailName,
    }) => {
      window.history.pushState({}, '', path)
      const user = userEvent.setup()
      render(<App />)

      await user.click(screen.getByRole('button', { name: action }))

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.getByRole('form', { name: form })).toBeVisible()
      expect(
        within(screen.getByRole('banner')).getByRole('heading', {
          name: heading,
        }),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Add record' })).toBeDisabled()

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('form', { name: form })).not.toBeInTheDocument()
      expect(
        screen.queryByRole('row', { name: rowName }),
      ).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: action }))
      await user.type(screen.getByLabelText(requiredLabel), value)

      if (secondaryRequiredLabel && secondaryValue) {
        await user.type(
          screen.getByLabelText(secondaryRequiredLabel),
          secondaryValue,
        )
      }

      await user.click(screen.getByRole('button', { name: 'Add record' }))

      expect(screen.queryByRole('form', { name: form })).not.toBeInTheDocument()
      expect(screen.getByRole('row', { name: rowName })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      expect(
        screen.getByRole('complementary', { name: detailName }),
      ).toBeInTheDocument()

      await user.type(
        screen.getByRole('searchbox', { name: searchLabel }),
        value,
      )

      expect(screen.getByRole('row', { name: rowName })).toBeVisible()
      expect(
        screen.getByRole('complementary', { name: detailName }),
      ).toBeInTheDocument()
    },
  )

  it('keeps manually entered track release text unlinked until a real release is selected', async () => {
    window.history.pushState({}, '', '/tracks')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add track' }))
    const form = screen.getByRole('form', { name: 'Add track' })

    await user.type(within(form).getByLabelText('Title'), 'Desk Tape Index')
    await user.type(
      within(form).getByLabelText('Linked release'),
      'Unfiled Tape Box',
    )
    await user.click(screen.getByRole('button', { name: 'Add record' }))

    const detailPanel = screen.getByRole('complementary', {
      name: 'Desk Tape Index',
    })
    const linkedReleaseSection = detailSection(detailPanel, 'Linked release')

    expect(
      within(linkedReleaseSection).getByText('Unfiled Tape Box'),
    ).toBeInTheDocument()
    expect(
      within(linkedReleaseSection).queryByRole('link', {
        name: 'Unfiled Tape Box',
      }),
    ).not.toBeInTheDocument()
  })

  it('keeps manually entered owned item release text unlinked until a real release is selected', async () => {
    window.history.pushState({}, '', '/owned-items')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add owned item' }))
    const form = screen.getByRole('form', { name: 'Add owned item' })

    await user.type(
      within(form).getByLabelText('Item name'),
      'Dubplate Sleeve Note',
    )
    await user.type(
      within(form).getByLabelText('Linked release'),
      'White Label Stack',
    )
    await user.click(screen.getByRole('button', { name: 'Add record' }))

    const detailPanel = screen.getByRole('complementary', {
      name: 'Dubplate Sleeve Note',
    })
    const linkedItemSection = detailSection(detailPanel, 'Linked catalog item')

    expect(
      within(linkedItemSection).getByText('White Label Stack'),
    ).toBeInTheDocument()
    expect(
      within(linkedItemSection).queryByRole('link', {
        name: 'White Label Stack',
      }),
    ).not.toBeInTheDocument()
  })

  it('edits a manual artist and updates the current row and detail', async () => {
    window.history.pushState({}, '', '/artists')
    const user = userEvent.setup()
    render(<App />)

    await addManualArtist(user, 'Session Draft Artist')

    expect(screen.getByText('Session-only editable record')).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: 'Edit session record' }),
    )
    const form = screen.getByRole('form', { name: 'Edit artist' })
    await user.clear(within(form).getByLabelText('Name'))
    await user.type(
      within(form).getByLabelText('Name'),
      'Session Edited Artist',
    )
    await user.click(within(form).getByRole('button', { name: 'Save record' }))

    expect(
      screen.getByRole('row', { name: /session edited artist/i }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(
      screen.queryByRole('row', { name: /session draft artist/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('complementary', { name: 'Session Edited Artist' }),
    ).toBeInTheDocument()
  })

  it('edits manual records and updates catalog rows immediately', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: 'Artists' }))
    await addManualArtist(user, 'Catalog Session Artist')
    await user.click(
      screen.getByRole('button', { name: 'Edit session record' }),
    )
    let form = screen.getByRole('form', { name: 'Edit artist' })
    await user.clear(within(form).getByLabelText('Name'))
    await user.type(
      within(form).getByLabelText('Name'),
      'Catalog Edited Artist',
    )
    await user.click(within(form).getByRole('button', { name: 'Save record' }))

    await user.click(screen.getByRole('link', { name: 'Catalog' }))
    await user.type(
      screen.getByRole('searchbox', { name: 'Search collection' }),
      'Catalog Edited Artist',
    )

    expect(
      screen.getByRole('row', { name: /catalog edited artist/i }),
    ).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /catalog session artist/i }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Releases' }))
    await user.click(screen.getByRole('button', { name: 'Add release' }))
    form = screen.getByRole('form', { name: 'Add release' })
    await user.type(within(form).getByLabelText('Title'), 'Catalog Session EP')
    await selectVisibleOption(
      user,
      within(form).getByLabelText('Existing artist'),
      'Catalog Edited Artist',
    )
    await user.click(within(form).getByRole('button', { name: 'Add record' }))
    await user.click(
      screen.getByRole('button', { name: 'Edit session record' }),
    )
    form = screen.getByRole('form', { name: 'Edit release' })
    await user.clear(within(form).getByLabelText('Title'))
    await user.type(within(form).getByLabelText('Title'), 'Catalog Edited EP')
    await user.click(within(form).getByRole('button', { name: 'Save record' }))

    await user.click(screen.getByRole('link', { name: 'Catalog' }))
    await user.clear(
      screen.getByRole('searchbox', { name: 'Search collection' }),
    )
    await user.type(
      screen.getByRole('searchbox', { name: 'Search collection' }),
      'Catalog Edited EP',
    )

    expect(
      screen.getByRole('row', { name: /catalog edited ep/i }),
    ).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /catalog session ep/i }),
    ).not.toBeInTheDocument()
  })

  it('keeps backlinks current when a linked manual artist is edited', async () => {
    window.history.pushState({}, '', '/artists')
    const user = userEvent.setup()
    render(<App />)

    await addManualArtist(user, 'Backlink Session Artist')
    await user.click(screen.getByRole('link', { name: 'Releases' }))
    await user.click(screen.getByRole('button', { name: 'Add release' }))
    const releaseForm = screen.getByRole('form', { name: 'Add release' })
    await user.type(within(releaseForm).getByLabelText('Title'), 'Backlink EP')
    await selectVisibleOption(
      user,
      within(releaseForm).getByLabelText('Existing artist'),
      'Backlink Session Artist',
    )
    await user.click(
      within(releaseForm).getByRole('button', { name: 'Add record' }),
    )

    await user.click(screen.getByRole('link', { name: 'Artists' }))
    await user.click(
      screen.getByRole('button', { name: /backlink session artist/i }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Edit session record' }),
    )
    const artistForm = screen.getByRole('form', { name: 'Edit artist' })
    await user.clear(within(artistForm).getByLabelText('Name'))
    await user.type(
      within(artistForm).getByLabelText('Name'),
      'Backlink Edited Artist',
    )
    await user.click(
      within(artistForm).getByRole('button', { name: 'Save record' }),
    )

    const detailPanel = screen.getByRole('complementary', {
      name: 'Backlink Edited Artist',
    })
    expect(
      within(detailSection(detailPanel, 'Graph backlinks')).getByRole('link', {
        name: 'Backlink EP',
      }),
    ).toHaveAttribute(
      'href',
      expect.stringContaining('/releases?release=manual-release-backlink-ep-'),
    )

    await user.click(screen.getByRole('link', { name: 'Releases' }))
    await user.click(screen.getByRole('button', { name: /backlink ep/i }))
    const releaseDetail = screen.getByRole('complementary', {
      name: 'Backlink EP',
    })
    expect(
      within(detailSection(releaseDetail, 'Release metadata')).getByText(
        'Backlink Edited Artist',
      ),
    ).toBeInTheDocument()
  })

  it('does not expose edit controls for seed records', () => {
    window.history.pushState({}, '', '/artists?artist=aphex-twin')

    render(<App />)

    expect(
      screen.getByRole('complementary', { name: 'Aphex Twin' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit session record' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Session-only editable record'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /delete session record/i }),
    ).not.toBeInTheDocument()
  })

  it.each(['/imports', '/exports'])(
    'keeps manual session edit controls out of %s',
    (path) => {
      window.history.pushState({}, '', path)

      render(<App />)

      expect(
        screen.queryByRole('button', { name: 'Edit session record' }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('form', { name: /edit/i }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('Session-only editable record'),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /delete session record/i }),
      ).not.toBeInTheDocument()
    },
  )

  it('deletes a manual artist only after confirmation and clears the selected detail and catalog row', async () => {
    window.history.pushState({}, '', '/artists')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<App />)

    await addManualArtist(user, 'Delete Session Artist')

    expect(
      screen.getByRole('complementary', { name: 'Delete Session Artist' }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Delete session record' }),
    )

    expect(confirmSpy).toHaveBeenCalledWith(
      'Delete this manual session artist? This cannot be undone.',
    )
    expect(
      screen.getByRole('row', { name: /delete session artist/i }),
    ).toBeVisible()

    confirmSpy.mockReturnValue(true)

    await user.click(
      screen.getByRole('button', { name: 'Delete session record' }),
    )

    expect(
      screen.queryByRole('row', { name: /delete session artist/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('complementary', { name: 'Delete Session Artist' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Catalog' }))
    await user.type(
      screen.getByRole('searchbox', { name: 'Search collection' }),
      'Delete Session Artist',
    )

    expect(screen.getByText('0 shown')).toBeInTheDocument()

    confirmSpy.mockRestore()
  })

  it('recovers the workspace query parameter after deleting the selected manual record', async () => {
    window.history.pushState({}, '', '/artists')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)

    await addManualArtist(user, 'Query Recovery Artist')

    expect(new URLSearchParams(window.location.search).get('artist')).toMatch(
      /^manual-artist-query-recovery-artist-/,
    )

    await user.click(
      screen.getByRole('button', { name: 'Delete session record' }),
    )

    expect(
      new URLSearchParams(window.location.search).get('artist'),
    ).not.toMatch(/^manual-artist-query-recovery-artist-/)
    expect(
      screen.queryByRole('row', { name: /query recovery artist/i }),
    ).not.toBeInTheDocument()

    confirmSpy.mockRestore()
  })

  it('deleting a linked manual release downgrades dependent references and updates backlinks', async () => {
    window.history.pushState({}, '', '/releases')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add release' }))
    let form = screen.getByRole('form', { name: 'Add release' })
    await user.type(within(form).getByLabelText('Title'), 'Delete Linked EP')
    await user.type(within(form).getByLabelText('Artist'), 'Delete Link Artist')
    await user.click(within(form).getByRole('button', { name: 'Add record' }))

    await user.click(screen.getByRole('link', { name: 'Tracks' }))
    await user.click(screen.getByRole('button', { name: 'Add track' }))
    form = screen.getByRole('form', { name: 'Add track' })
    await user.type(within(form).getByLabelText('Title'), 'Delete Linked Track')
    await selectVisibleOption(
      user,
      within(form).getByLabelText('Existing release'),
      'Delete Linked EP',
    )
    await user.click(within(form).getByRole('button', { name: 'Add record' }))

    await user.click(screen.getByRole('link', { name: 'Relations' }))
    await user.click(screen.getByRole('button', { name: 'Add relation' }))
    form = screen.getByRole('form', { name: 'Add relation' })
    await user.type(within(form).getByLabelText('Source'), 'Free Source')
    await selectVisibleOption(
      user,
      within(form).getByLabelText('Existing target'),
      'Release: Delete Linked EP',
    )
    await selectVisibleOption(
      user,
      within(form).getByLabelText('Existing linked entity'),
      'Track: Delete Linked Track',
    )
    await user.click(within(form).getByRole('button', { name: 'Add record' }))

    await user.click(screen.getByRole('link', { name: 'Releases' }))
    await user.click(screen.getByRole('button', { name: /delete linked ep/i }))

    expect(
      within(
        detailSection(
          screen.getByRole('complementary', { name: 'Delete Linked EP' }),
          'Tracks',
        ),
      ).getByRole('link', { name: 'Delete Linked Track' }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Delete session record' }),
    )

    expect(
      screen.queryByRole('row', { name: /delete linked ep/i }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Tracks' }))
    await user.click(
      screen.getByRole('button', { name: /delete linked track/i }),
    )

    const trackPanel = screen.getByRole('complementary', {
      name: 'Delete Linked Track',
    })
    const linkedRelease = detailSection(trackPanel, 'Linked release')

    expect(within(linkedRelease).getByText('Delete Linked EP')).toBeVisible()
    expect(
      within(linkedRelease).queryByRole('link', { name: 'Delete Linked EP' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Relations' }))
    await user.click(
      screen.getByRole('button', { name: /free source delete linked ep/i }),
    )

    const relationPanel = screen.getByRole('complementary', {
      name: 'Free Source to Delete Linked EP',
    })

    expect(
      within(detailSection(relationPanel, 'Endpoints')).queryByRole('link', {
        name: 'Delete Linked EP',
      }),
    ).not.toBeInTheDocument()
    expect(
      within(detailSection(relationPanel, 'Linked evidence')).getByRole(
        'link',
        { name: 'Delete Linked Track' },
      ),
    ).toHaveAttribute('href', expect.stringContaining('/tracks?track=manual-'))

    confirmSpy.mockRestore()
  })

  it('deleting a linked manual track downgrades relation evidence immediately', async () => {
    window.history.pushState({}, '', '/tracks')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add track' }))
    let form = screen.getByRole('form', { name: 'Add track' })
    await user.type(within(form).getByLabelText('Title'), 'Evidence Track')
    await user.click(within(form).getByRole('button', { name: 'Add record' }))

    await user.click(screen.getByRole('link', { name: 'Relations' }))
    await user.click(screen.getByRole('button', { name: 'Add relation' }))
    form = screen.getByRole('form', { name: 'Add relation' })
    await user.type(within(form).getByLabelText('Source'), 'Evidence Source')
    await user.type(within(form).getByLabelText('Target'), 'Evidence Target')
    await selectVisibleOption(
      user,
      within(form).getByLabelText('Existing linked entity'),
      'Track: Evidence Track',
    )
    await user.click(within(form).getByRole('button', { name: 'Add record' }))

    expect(
      within(
        detailSection(
          screen.getByRole('complementary', {
            name: 'Evidence Source to Evidence Target',
          }),
          'Linked evidence',
        ),
      ).getByRole('link', { name: 'Evidence Track' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Tracks' }))
    await user.click(screen.getByRole('button', { name: /evidence track/i }))
    await user.click(
      screen.getByRole('button', { name: 'Delete session record' }),
    )

    await user.click(screen.getByRole('link', { name: 'Relations' }))
    await user.click(
      screen.getByRole('button', { name: /evidence source evidence target/i }),
    )

    const linkedEvidence = detailSection(
      screen.getByRole('complementary', {
        name: 'Evidence Source to Evidence Target',
      }),
      'Linked evidence',
    )

    expect(within(linkedEvidence).getByText('Evidence Track')).toBeVisible()
    expect(
      within(linkedEvidence).queryByRole('link', { name: 'Evidence Track' }),
    ).not.toBeInTheDocument()

    confirmSpy.mockRestore()
  })

  it('clearing relation existing-record selects prevents stale linked ids', async () => {
    window.history.pushState({}, '', '/relations')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add relation' }))
    const form = screen.getByRole('form', { name: 'Add relation' })

    await user.selectOptions(
      within(form).getByLabelText('Existing source'),
      'artist:aphex-twin',
    )
    await user.selectOptions(
      within(form).getByLabelText('Existing target'),
      'release:selected-ambient-works-85-92',
    )
    await user.selectOptions(
      within(form).getByLabelText('Existing linked entity'),
      'track:polynomial-c',
    )

    expect(within(form).getByLabelText('Source')).toBeDisabled()
    expect(within(form).getByLabelText('Target')).toBeDisabled()
    expect(within(form).getByLabelText('Linked entity')).toBeDisabled()

    await user.selectOptions(within(form).getByLabelText('Existing source'), '')
    await user.selectOptions(within(form).getByLabelText('Existing target'), '')
    await user.selectOptions(
      within(form).getByLabelText('Existing linked entity'),
      '',
    )
    await user.type(within(form).getByLabelText('Source'), 'Plain Source')
    await user.type(within(form).getByLabelText('Target'), 'Plain Target')
    await user.type(
      within(form).getByLabelText('Linked entity'),
      'Plain Evidence',
    )
    await user.click(within(form).getByRole('button', { name: 'Add record' }))

    const detailPanel = screen.getByRole('complementary', {
      name: 'Plain Source to Plain Target',
    })

    expect(
      within(detailSection(detailPanel, 'Endpoints')).queryByRole('link', {
        name: 'Aphex Twin',
      }),
    ).not.toBeInTheDocument()
    expect(
      within(detailSection(detailPanel, 'Endpoints')).queryByRole('link', {
        name: 'Selected Ambient Works 85-92',
      }),
    ).not.toBeInTheDocument()
    expect(
      within(detailSection(detailPanel, 'Linked evidence')).queryByRole(
        'link',
        {
          name: 'Polynomial-C',
        },
      ),
    ).not.toBeInTheDocument()
    expect(
      within(detailSection(detailPanel, 'Linked evidence')).getByText(
        'Plain Evidence',
      ),
    ).toBeVisible()
  })

  it('deleting a manual relation downgrades relation-backed links immediately', async () => {
    window.history.pushState({}, '', '/relations')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add relation' }))
    let form = screen.getByRole('form', { name: 'Add relation' })
    await user.type(within(form).getByLabelText('Source'), 'Referenced Source')
    await user.type(within(form).getByLabelText('Target'), 'Referenced Target')
    await user.click(within(form).getByRole('button', { name: 'Add record' }))

    await user.click(screen.getByRole('button', { name: 'Add relation' }))
    form = screen.getByRole('form', { name: 'Add relation' })
    await selectVisibleOption(
      user,
      within(form).getByLabelText('Existing source'),
      'Relation: Referenced Source to Referenced Target',
    )
    await selectVisibleOption(
      user,
      within(form).getByLabelText('Existing target'),
      'Relation: Referenced Source to Referenced Target',
    )
    await selectVisibleOption(
      user,
      within(form).getByLabelText('Existing linked entity'),
      'Relation: Referenced Source to Referenced Target',
    )
    await user.click(within(form).getByRole('button', { name: 'Add record' }))

    const dependentRelationName =
      'Referenced Source to Referenced Target to Referenced Source to Referenced Target'
    const dependentPanel = screen.getByRole('complementary', {
      name: dependentRelationName,
    })

    expect(
      within(detailSection(dependentPanel, 'Endpoints')).getAllByRole('link', {
        name: 'Referenced Source to Referenced Target',
      }),
    ).toHaveLength(2)
    expect(
      within(detailSection(dependentPanel, 'Linked evidence')).getByRole(
        'link',
        { name: 'Referenced Source to Referenced Target' },
      ),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: /^Referenced Source Referenced Target$/,
      }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Delete session record' }),
    )
    await user.click(
      screen.getByRole('button', {
        name: /^Referenced Source to Referenced Target Referenced Source to Referenced Target$/,
      }),
    )

    const updatedPanel = screen.getByRole('complementary', {
      name: dependentRelationName,
    })
    const endpoints = detailSection(updatedPanel, 'Endpoints')
    const linkedEvidence = detailSection(updatedPanel, 'Linked evidence')

    expect(
      within(endpoints).queryByRole('link', {
        name: 'Referenced Source to Referenced Target',
      }),
    ).not.toBeInTheDocument()
    expect(
      within(linkedEvidence).queryByRole('link', {
        name: 'Referenced Source to Referenced Target',
      }),
    ).not.toBeInTheDocument()
    expect(
      within(endpoints).getAllByText('Referenced Source to Referenced Target'),
    ).toHaveLength(2)
    expect(
      within(linkedEvidence).getByText(
        'Referenced Source to Referenced Target',
      ),
    ).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: 'Edit session record' }),
    )

    const editForm = screen.getByRole('form', { name: 'Edit relation' })

    expect(within(editForm).getByLabelText('Existing source')).toHaveValue('')
    expect(within(editForm).getByLabelText('Existing target')).toHaveValue('')
    expect(
      within(editForm).getByLabelText('Existing linked entity'),
    ).toHaveValue('')
    expect(within(editForm).getByLabelText('Source')).toBeEnabled()
    expect(within(editForm).getByLabelText('Source')).toHaveValue(
      'Referenced Source to Referenced Target',
    )
    expect(within(editForm).getByLabelText('Target')).toBeEnabled()
    expect(within(editForm).getByLabelText('Target')).toHaveValue(
      'Referenced Source to Referenced Target',
    )
    expect(within(editForm).getByLabelText('Linked entity')).toBeEnabled()
    expect(within(editForm).getByLabelText('Linked entity')).toHaveValue(
      'Referenced Source to Referenced Target',
    )

    confirmSpy.mockRestore()
  })

  it('warns about likely duplicates during edit without blocking save', async () => {
    window.history.pushState({}, '', '/artists')
    const user = userEvent.setup()
    render(<App />)

    await addManualArtist(user, 'Duplicate Anchor Artist')
    await addManualArtist(user, 'Duplicate Candidate Artist')

    await user.click(
      screen.getByRole('button', { name: /duplicate candidate artist/i }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Edit session record' }),
    )
    const form = screen.getByRole('form', { name: 'Edit artist' })
    await user.clear(within(form).getByLabelText('Name'))
    await user.type(
      within(form).getByLabelText('Name'),
      'Duplicate Anchor Artist',
    )

    expect(
      within(form).getByText(
        /Likely duplicate artist: Duplicate Anchor Artist/i,
      ),
    ).toBeVisible()
    expect(
      within(form).getByRole('button', { name: 'Save record' }),
    ).toBeEnabled()

    await user.click(within(form).getByRole('button', { name: 'Save record' }))

    expect(
      screen.getAllByRole('row', { name: /duplicate anchor artist/i }),
    ).toHaveLength(2)
  })

  it('clearing an existing-record select prevents stale linked ids and keeps free text plain', async () => {
    window.history.pushState({}, '', '/owned-items')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add owned item' }))
    let form = screen.getByRole('form', { name: 'Add owned item' })
    await user.type(
      within(form).getByLabelText('Item name'),
      'Loose Sleeve Copy',
    )
    await user.selectOptions(
      within(form).getByLabelText('Existing release'),
      'selected-ambient-works-85-92',
    )
    await user.click(within(form).getByRole('button', { name: 'Add record' }))

    expect(
      within(
        detailSection(
          screen.getByRole('complementary', { name: 'Loose Sleeve Copy' }),
          'Linked catalog item',
        ),
      ).getByRole('link', { name: 'Selected Ambient Works 85-92' }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Edit session record' }),
    )
    form = screen.getByRole('form', { name: 'Edit owned item' })
    await user.selectOptions(
      within(form).getByLabelText('Existing release'),
      '',
    )
    await user.type(
      within(form).getByLabelText('Linked release'),
      'Unfiled Sleeve Box',
    )
    await user.click(within(form).getByRole('button', { name: 'Save record' }))

    const linkedSection = detailSection(
      screen.getByRole('complementary', { name: 'Loose Sleeve Copy' }),
      'Linked catalog item',
    )

    expect(within(linkedSection).getByText('Unfiled Sleeve Box')).toBeVisible()
    expect(
      within(linkedSection).queryByRole('link', { name: 'Unfiled Sleeve Box' }),
    ).not.toBeInTheDocument()
    expect(
      within(linkedSection).queryByRole('link', {
        name: 'Selected Ambient Works 85-92',
      }),
    ).not.toBeInTheDocument()
  })

  it('preserves existing draft track fields when editing a manual track', async () => {
    window.history.pushState({}, '', '/releases')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add release' }))
    const releaseForm = screen.getByRole('form', { name: 'Add release' })

    await user.type(
      within(releaseForm).getByLabelText('Title'),
      'Numbered Draft Source',
    )
    await user.click(
      within(releaseForm).getByRole('button', { name: 'Add track row' }),
    )
    await user.type(
      within(releaseForm).getByLabelText('Draft track 1 title'),
      'Numbered Draft Track',
    )
    await user.type(
      within(releaseForm).getByLabelText('Draft track 1 file format'),
      'FLAC',
    )
    await user.click(
      within(releaseForm).getByRole('button', { name: 'Add record' }),
    )

    await user.click(screen.getByRole('link', { name: 'Tracks' }))
    await user.click(
      screen.getByRole('button', { name: /numbered draft track/i }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Edit session record' }),
    )

    const trackForm = screen.getByRole('form', { name: 'Edit track' })
    await user.clear(within(trackForm).getByLabelText('Title'))
    await user.type(
      within(trackForm).getByLabelText('Title'),
      'Numbered Draft Track Edited',
    )
    await user.click(
      within(trackForm).getByRole('button', { name: 'Save record' }),
    )

    expect(
      screen.getByRole('row', {
        name: /numbered draft track edited.*track 1/i,
      }),
    ).toBeVisible()
    expect(
      within(
        detailSection(
          screen.getByRole('complementary', {
            name: 'Numbered Draft Track Edited',
          }),
          'Local file metadata',
        ),
      ).getByText('FLAC'),
    ).toBeInTheDocument()
  })

  it('does not rewrite unrelated relation free text when a manual release with the same title is edited', async () => {
    window.history.pushState({}, '', '/relations')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add relation' }))
    const relationForm = screen.getByRole('form', { name: 'Add relation' })

    await user.type(
      within(relationForm).getByLabelText('Source'),
      'Free Source',
    )
    await user.type(
      within(relationForm).getByLabelText('Target'),
      'Free Target',
    )
    await user.type(
      within(relationForm).getByLabelText('Linked entity'),
      'Shared Title',
    )
    await user.click(
      within(relationForm).getByRole('button', { name: 'Add record' }),
    )

    await user.click(screen.getByRole('link', { name: 'Releases' }))
    await user.click(screen.getByRole('button', { name: 'Add release' }))
    let releaseForm = screen.getByRole('form', { name: 'Add release' })
    await user.type(within(releaseForm).getByLabelText('Title'), 'Shared Title')
    await user.type(
      within(releaseForm).getByLabelText('Artist'),
      'First Artist',
    )
    await user.click(
      within(releaseForm).getByRole('button', { name: 'Add record' }),
    )

    await user.click(screen.getByRole('button', { name: 'Add release' }))
    releaseForm = screen.getByRole('form', { name: 'Add release' })
    await user.type(within(releaseForm).getByLabelText('Title'), 'Shared Title')
    await user.type(
      within(releaseForm).getByLabelText('Artist'),
      'Second Artist',
    )
    await user.click(
      within(releaseForm).getByRole('button', { name: 'Add record' }),
    )

    await user.click(
      screen.getByRole('button', { name: 'Edit session record' }),
    )
    releaseForm = screen.getByRole('form', { name: 'Edit release' })
    await user.clear(within(releaseForm).getByLabelText('Title'))
    await user.type(
      within(releaseForm).getByLabelText('Title'),
      'Renamed Shared Title',
    )
    await user.click(
      within(releaseForm).getByRole('button', { name: 'Save record' }),
    )

    await user.click(screen.getByRole('link', { name: 'Relations' }))
    await user.click(
      screen.getByRole('button', { name: /free source free target/i }),
    )

    const linkedEvidence = detailSection(
      screen.getByRole('complementary', {
        name: 'Free Source to Free Target',
      }),
      'Linked evidence',
    )

    expect(within(linkedEvidence).getByText('Shared Title')).toBeInTheDocument()
    expect(
      within(linkedEvidence).queryByText('Renamed Shared Title'),
    ).not.toBeInTheDocument()
  })

  it('keeps manual record ids unique when records are created in the same millisecond', () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(123)

    try {
      expect(createManualRecordId('track', 'Same Title')).not.toBe(
        createManualRecordId('track', 'Same Title'),
      )
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('renders the catalog workspace at /catalog', () => {
    window.history.pushState({}, '', '/catalog')

    render(<App />)

    expect(screen.getByRole('heading', { name: 'Catalog' })).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: 'Search collection' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Catalog workspace' }),
    ).toBeInTheDocument()
  })

  it.each([
    ['/releases', 'Releases', 'Search releases'],
    ['/playlists', 'Playlists', 'Search playlists'],
    ['/imports', 'Imports', 'Local folder scans and metadata intake.'],
    ['/exports', 'Exports', 'Portable snapshots for collection data.'],
    ['/settings', 'Settings', 'Search settings'],
  ])('renders the %s workspace route', (path, heading, description) => {
    window.history.pushState({}, '', path)

    render(<App />)

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    if (path === '/releases' || path === '/playlists' || path === '/settings') {
      expect(screen.getByRole('searchbox', { name: description })).toBeVisible()
    } else {
      expect(screen.getByText(description)).toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: heading })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('renders the artists workspace with relation-first artist rows', () => {
    window.history.pushState({}, '', '/artists')

    render(<App />)

    expect(
      screen.getByRole('region', { name: 'Artists workspace' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: 'Search artists' }),
    ).toBeVisible()
    expect(screen.getByRole('row', { name: /aphex twin/i })).toBeVisible()
    expect(screen.getByRole('row', { name: /the dfa/i })).toBeVisible()
    expect(
      screen.getByRole('complementary', { name: 'Aphex Twin' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Relations and credits')).toBeInTheDocument()
  })

  it('filters artists by name, type, alias and credit hints', async () => {
    window.history.pushState({}, '', '/artists')
    const user = userEvent.setup()
    render(<App />)

    await user.type(
      screen.getByRole('searchbox', { name: 'Search artists' }),
      'remixer',
    )

    expect(screen.getByRole('row', { name: /the dfa/i })).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /new order/i }),
    ).not.toBeInTheDocument()
  })

  it('updates artist detail when an artist row is selected', async () => {
    window.history.pushState({}, '', '/artists')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /the dfa/i }))

    const detailPanel = screen.getByRole('complementary', { name: 'The DFA' })

    expect(
      within(detailPanel).getByRole('heading', { name: 'The DFA' }),
    ).toBeInTheDocument()
    expect(within(detailPanel).getByText('Remixer')).toBeInTheDocument()
    expect(within(detailPanel).getByText('LCD Soundsystem')).toBeInTheDocument()
  })

  it('links known artist credit and relation targets while leaving unknown targets as plain text', () => {
    window.history.pushState({}, '', '/artists?artist=aphex-twin')

    render(<App />)

    const detailPanel = screen.getByRole('complementary', {
      name: 'Aphex Twin',
    })

    expect(
      within(detailSection(detailPanel, 'Credit appearances')).getAllByRole(
        'link',
        { name: 'Selected Ambient Works 85-92' },
      )[0],
    ).toHaveAttribute('href', '/releases?release=selected-ambient-works-85-92')
    expect(
      within(detailSection(detailPanel, 'Credit appearances')).getByRole(
        'link',
        { name: 'Polynomial-C' },
      ),
    ).toHaveAttribute('href', '/tracks?track=polynomial-c')
    expect(
      within(detailSection(detailPanel, 'Relations and credits')).getByText(
        'AFX',
      ),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).queryByRole('link', { name: 'AFX' }),
    ).not.toBeInTheDocument()
  })

  it('renders the releases workspace with release rows and selected detail', () => {
    window.history.pushState({}, '', '/releases')

    render(<App />)

    expect(
      screen.getByRole('region', { name: 'Releases workspace' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: 'Search releases' }),
    ).toBeVisible()
    expect(
      screen.getByRole('row', { name: /selected ambient works 85-92/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('complementary', {
        name: 'Selected Ambient Works 85-92',
      }),
    ).toBeInTheDocument()
  })

  it('filters releases by title, artist, label, year, media and ownership status', async () => {
    window.history.pushState({}, '', '/releases')
    const user = userEvent.setup()
    render(<App />)

    await user.type(
      screen.getByRole('searchbox', { name: 'Search releases' }),
      'factory needs digitization',
    )

    expect(screen.getByRole('row', { name: /blue monday/i })).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /selected ambient works/i }),
    ).not.toBeInTheDocument()
  })

  it('separates release metadata from owned copies in release detail', () => {
    window.history.pushState({}, '', '/releases')

    render(<App />)

    const detailPanel = screen.getByRole('complementary', {
      name: 'Selected Ambient Works 85-92',
    })

    expect(
      within(detailPanel).getByRole('heading', { name: 'Release metadata' }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', { name: 'Owned copies' }),
    ).toBeInTheDocument()
    expect(within(detailPanel).getByText('Warp')).toBeInTheDocument()
    expect(within(detailPanel).getByText('Digital library')).toBeInTheDocument()
  })

  it('selects a release from the release query parameter', () => {
    window.history.pushState({}, '', '/releases?release=blue-monday')

    render(<App />)

    expect(
      screen.getByRole('complementary', { name: 'Blue Monday' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /blue monday/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it.each([
    ['/artists?artist=the-dfa', 'The DFA', /the dfa/i],
    ['/tracks?track=blue-monday', 'Blue Monday', /blue monday/i],
    [
      '/owned-items?ownedItem=blue-monday-vinyl',
      'Blue Monday vinyl',
      /blue monday vinyl/i,
    ],
    [
      '/relations?relation=the-dfa-lcd-soundsystem',
      'The DFA to LCD Soundsystem',
      /the dfa lcd soundsystem/i,
    ],
    [
      '/playlists?playlist=needs-digitization-physical',
      'Needs digitization physical',
      /needs digitization physical/i,
    ],
  ])('selects catalog detail from %s', (path, detailName, rowName) => {
    window.history.pushState({}, '', path)

    render(<App />)

    expect(
      screen.getByRole('complementary', { name: detailName }),
    ).toBeInTheDocument()
    expect(screen.getByRole('row', { name: rowName })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it.each([
    ['/artists?artist=missing', 'Aphex Twin'],
    ['/releases?release=missing', 'Selected Ambient Works 85-92'],
    ['/tracks?track=missing', 'Polynomial-C'],
    ['/owned-items?ownedItem=missing', 'Selected Ambient Works CD'],
    ['/relations?relation=missing', 'Richard D. James to Aphex Twin'],
    ['/playlists?playlist=missing', 'Late night lossless shelf'],
  ])('falls back safely for invalid deep links at %s', (path, detailName) => {
    window.history.pushState({}, '', path)

    render(<App />)

    expect(
      screen.getByRole('complementary', { name: detailName }),
    ).toBeInTheDocument()
  })

  it.each([
    ['/artists', /the dfa/i, 'artist', 'the-dfa'],
    ['/releases', /blue monday/i, 'release', 'blue-monday'],
    ['/tracks', /blue monday/i, 'track', 'blue-monday'],
    ['/owned-items', /blue monday vinyl/i, 'ownedItem', 'blue-monday-vinyl'],
    [
      '/relations',
      /the dfa lcd soundsystem/i,
      'relation',
      'the-dfa-lcd-soundsystem',
    ],
    [
      '/playlists',
      /needs digitization physical/i,
      'playlist',
      'needs-digitization-physical',
    ],
  ])(
    'updates the URL query when selecting a row in %s',
    async (path, rowName, queryParam, id) => {
      window.history.pushState({}, '', path)
      const user = userEvent.setup()
      render(<App />)

      await user.click(screen.getByRole('button', { name: rowName }))

      expect(window.location.pathname).toBe(path)
      expect(new URLSearchParams(window.location.search).get(queryParam)).toBe(
        id,
      )
    },
  )

  it('keeps browser history selection in sync with row query params', async () => {
    window.history.pushState({}, '', '/tracks?track=polynomial-c')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /blue monday/i }))

    expect(
      screen.getByRole('complementary', { name: 'Blue Monday' }),
    ).toBeInTheDocument()

    act(() => {
      window.history.pushState({}, '', '/tracks?track=polynomial-c')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(
      await screen.findByRole('complementary', { name: 'Polynomial-C' }),
    ).toBeInTheDocument()

    act(() => {
      window.history.pushState({}, '', '/tracks?track=blue-monday')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(
      await screen.findByRole('complementary', { name: 'Blue Monday' }),
    ).toBeInTheDocument()
  })

  it('renders the tracks workspace with track rows and selected detail', () => {
    window.history.pushState({}, '', '/tracks')

    render(<App />)

    expect(
      screen.getByRole('region', { name: 'Tracks workspace' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: 'Search tracks' }),
    ).toBeVisible()
    expect(screen.getByRole('row', { name: /polynomial-c/i })).toBeVisible()
    expect(
      screen.getByRole('complementary', { name: 'Polynomial-C' }),
    ).toBeInTheDocument()
  })

  it('filters tracks by title, artist, release, duration, credits, versions, relations and file format', async () => {
    window.history.pushState({}, '', '/tracks')
    const user = userEvent.setup()
    render(<App />)

    await user.type(
      screen.getByRole('searchbox', { name: 'Search tracks' }),
      'new order 07:29 factory version wav',
    )

    expect(screen.getByRole('row', { name: /blue monday/i })).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /polynomial-c/i }),
    ).not.toBeInTheDocument()
  })

  it('updates track detail when a track row is selected', async () => {
    window.history.pushState({}, '', '/tracks')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /blue monday/i }))

    const detailPanel = screen.getByRole('complementary', {
      name: 'Blue Monday',
    })

    expect(
      within(detailPanel).getByRole('heading', { name: 'Blue Monday' }),
    ).toBeInTheDocument()
    expect(within(detailPanel).getAllByText('New Order')).toHaveLength(4)
    expect(within(detailPanel).getByText(/factory/i)).toBeInTheDocument()
  })

  it('shows release link, credits, relations and file metadata as separate track detail sections', () => {
    window.history.pushState({}, '', '/tracks')

    render(<App />)

    const detailPanel = screen.getByRole('complementary', {
      name: 'Polynomial-C',
    })

    expect(
      within(detailPanel).getByRole('heading', { name: 'Linked release' }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('link', {
        name: 'Selected Ambient Works 85-92',
      }),
    ).toHaveAttribute('href', '/releases?release=selected-ambient-works-85-92')
    expect(
      within(detailPanel).getByRole('heading', { name: 'Track credits' }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', {
        name: 'Versions and relations',
      }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', { name: 'Local file metadata' }),
    ).toBeInTheDocument()
    expect(within(detailPanel).getByText('FLAC')).toBeInTheDocument()
    expect(
      within(detailPanel).getByText('44.1 kHz / 16-bit'),
    ).toBeInTheDocument()
  })

  it('renders an existing linked release in track detail as a navigable release link', () => {
    window.history.pushState({}, '', '/tracks')

    render(<App />)

    const detailPanel = screen.getByRole('complementary', {
      name: 'Polynomial-C',
    })

    expect(
      within(detailSection(detailPanel, 'Linked release')).getByRole('link', {
        name: 'Selected Ambient Works 85-92',
      }),
    ).toHaveAttribute('href', '/releases?release=selected-ambient-works-85-92')
  })

  it('lets a manual track select an existing release and stores a real release link', async () => {
    window.history.pushState({}, '', '/tracks')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add track' }))
    const form = screen.getByRole('form', { name: 'Add track' })

    await user.type(within(form).getByLabelText('Title'), 'Shelf Index Dub')
    await user.selectOptions(
      within(form).getByLabelText('Existing artist'),
      'aphex-twin',
    )
    await user.selectOptions(
      within(form).getByLabelText('Existing release'),
      'selected-ambient-works-85-92',
    )
    await user.click(screen.getByRole('button', { name: 'Add record' }))

    const detailPanel = screen.getByRole('complementary', {
      name: 'Shelf Index Dub',
    })

    expect(
      within(detailPanel).getAllByText('Aphex Twin').length,
    ).toBeGreaterThan(0)
    expect(
      within(detailSection(detailPanel, 'Linked release')).getByRole('link', {
        name: 'Selected Ambient Works 85-92',
      }),
    ).toHaveAttribute('href', '/releases?release=selected-ambient-works-85-92')
  })

  it('renders the playlists workspace with manual and smart playlist rows', () => {
    window.history.pushState({}, '', '/playlists')

    render(<App />)

    expect(
      screen.getByRole('region', { name: 'Playlists workspace' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: 'Search playlists' }),
    ).toBeVisible()
    expect(
      screen.getByRole('row', { name: /late night lossless shelf/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('row', { name: /lossless idm digital/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('row', { name: /needs digitization physical/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('complementary', {
        name: 'Late night lossless shelf',
      }),
    ).toBeInTheDocument()
  })

  it('filters playlists by name, type, track, artist, release, tags, year range, format, ownership and rule hints', async () => {
    window.history.pushState({}, '', '/playlists')
    const user = userEvent.setup()
    render(<App />)

    await user.type(
      screen.getByRole('searchbox', { name: 'Search playlists' }),
      'smart 1980-1989 new order vinyl needs digitization missing',
    )

    expect(
      screen.getByRole('row', { name: /needs digitization physical/i }),
    ).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /late night lossless shelf/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('row', { name: /lossless idm digital/i }),
    ).not.toBeInTheDocument()
  })

  it('updates playlist detail when a playlist row is selected', async () => {
    window.history.pushState({}, '', '/playlists')
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      screen.getByRole('button', { name: /needs digitization physical/i }),
    )

    const detailPanel = screen.getByRole('complementary', {
      name: 'Needs digitization physical',
    })

    expect(
      within(detailPanel).getByRole('heading', {
        name: 'Needs digitization physical',
      }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getAllByRole('link', { name: 'Blue Monday' }).length,
    ).toBeGreaterThan(0)
    expect(
      within(detailPanel).getByText('Ownership status is Needs digitization.'),
    ).toBeInTheDocument()
  })

  it('shows manual track selection in manual playlist detail', () => {
    window.history.pushState({}, '', '/playlists')

    render(<App />)

    const detailPanel = screen.getByRole('complementary', {
      name: 'Late night lossless shelf',
    })

    expect(
      within(
        detailSection(detailPanel, 'Smart rules / manual selection'),
      ).getByText('Manual track selection'),
    ).toBeInTheDocument()
    expect(
      within(
        detailSection(detailPanel, 'Smart rules / manual selection'),
      ).getByText(/no automatic catalog rule/i),
    ).toBeInTheDocument()
  })

  it('shows readable rule criteria in smart playlist detail', async () => {
    window.history.pushState({}, '', '/playlists')
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      screen.getByRole('button', { name: /lossless idm digital/i }),
    )

    const detailPanel = screen.getByRole('complementary', {
      name: 'Lossless IDM digital',
    })
    const rulesSection = detailSection(
      detailPanel,
      'Smart rules / manual selection',
    )

    expect(
      within(rulesSection).getByText(
        'Tags and file criteria select lossless digital IDM tracks.',
      ),
    ).toBeInTheDocument()
    expect(
      within(rulesSection).getByText('File format is FLAC.'),
    ).toBeInTheDocument()
  })

  it('shows playlist tracks, linked releases and owned availability as separate detail sections', () => {
    window.history.pushState({}, '', '/playlists')

    render(<App />)

    const detailPanel = screen.getByRole('complementary', {
      name: 'Late night lossless shelf',
    })

    expect(
      within(detailPanel).getByRole('heading', {
        name: 'Playlist metadata',
      }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', { name: 'Tracks' }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', {
        name: 'Smart rules / manual selection',
      }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', {
        name: 'Linked releases and owned availability',
      }),
    ).toBeInTheDocument()
    expect(
      within(detailSection(detailPanel, 'Tracks')).getByRole('link', {
        name: 'Polynomial-C',
      }),
    ).toHaveAttribute('href', '/tracks?track=polynomial-c')
    expect(
      within(detailPanel).getAllByRole('link', {
        name: 'Selected Ambient Works 85-92',
      })[0],
    ).toHaveAttribute('href', '/releases?release=selected-ambient-works-85-92')
    expect(
      within(
        detailSection(detailPanel, 'Linked releases and owned availability'),
      ).getByText('Unfiled white label'),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).queryByRole('link', {
        name: 'Unfiled white label',
      }),
    ).not.toBeInTheDocument()
    expect(within(detailPanel).getAllByText('Owned').length).toBeGreaterThan(0)
    expect(
      within(detailPanel).getByText(
        'Digital library and CD shelf B1 are available.',
      ),
    ).toBeInTheDocument()
  })

  it('shows an empty detail state when no playlists match the search query', async () => {
    window.history.pushState({}, '', '/playlists')
    const user = userEvent.setup()
    render(<App />)

    await user.type(
      screen.getByRole('searchbox', { name: 'Search playlists' }),
      'zzz no match at all',
    )

    expect(screen.getByText('0 shown')).toBeInTheDocument()
    expect(screen.getByText('No matching playlists.')).toBeInTheDocument()
  })

  it('renders the owned items workspace with copy rows and selected detail', () => {
    window.history.pushState({}, '', '/owned-items')

    render(<App />)

    expect(
      screen.getByRole('region', { name: 'Owned Items workspace' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: 'Search owned items' }),
    ).toBeVisible()
    expect(
      screen.getByRole('row', { name: /selected ambient works cd/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('complementary', {
        name: 'Selected Ambient Works CD',
      }),
    ).toBeInTheDocument()
  })

  it('filters owned items by release, artist, medium, status, storage, condition and file format', async () => {
    window.history.pushState({}, '', '/owned-items')
    const user = userEvent.setup()
    render(<App />)

    await user.type(
      screen.getByRole('searchbox', { name: 'Search owned items' }),
      'new order vinyl shelf a3 needs digitization',
    )

    expect(
      screen.getByRole('row', { name: /blue monday vinyl/i }),
    ).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /selected ambient works cd/i }),
    ).not.toBeInTheDocument()
  })

  it('updates owned item detail when an owned item row is selected', async () => {
    window.history.pushState({}, '', '/owned-items')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /blue monday vinyl/i }))

    const detailPanel = screen.getByRole('complementary', {
      name: 'Blue Monday vinyl',
    })

    expect(
      within(detailPanel).getByRole('heading', { name: 'Blue Monday vinyl' }),
    ).toBeInTheDocument()
    expect(within(detailPanel).getByText('Shelf A3')).toBeInTheDocument()
    expect(
      within(detailSection(detailPanel, 'Ownership state')).getByText(
        'Needs digitization',
      ),
    ).toBeInTheDocument()
    expect(
      within(
        detailSection(detailPanel, 'Digital and digitization metadata'),
      ).getByText('Needs digitization'),
    ).toBeInTheDocument()
  })

  it('shows release link, ownership, physical details and digitization metadata as separate owned item detail sections', () => {
    window.history.pushState({}, '', '/owned-items')

    render(<App />)

    const detailPanel = screen.getByRole('complementary', {
      name: 'Selected Ambient Works CD',
    })

    expect(
      within(detailPanel).getByRole('heading', { name: 'Linked catalog item' }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('link', {
        name: 'Selected Ambient Works 85-92',
      }),
    ).toHaveAttribute('href', '/releases?release=selected-ambient-works-85-92')
    expect(
      within(detailPanel).getByRole('heading', { name: 'Ownership state' }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', { name: 'Physical details' }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', {
        name: 'Digital and digitization metadata',
      }),
    ).toBeInTheDocument()
    expect(within(detailPanel).getByText('Very Good')).toBeInTheDocument()
    expect(
      within(detailPanel).getByText('Verified FLAC rip'),
    ).toBeInTheDocument()
  })

  it('renders an existing linked release in owned item detail as a navigable release link', () => {
    window.history.pushState({}, '', '/owned-items')

    render(<App />)

    const detailPanel = screen.getByRole('complementary', {
      name: 'Selected Ambient Works CD',
    })

    expect(
      within(detailSection(detailPanel, 'Linked catalog item')).getByRole(
        'link',
        {
          name: 'Selected Ambient Works 85-92',
        },
      ),
    ).toHaveAttribute('href', '/releases?release=selected-ambient-works-85-92')
  })

  it('lets a manual owned item select an existing release and stores a real release link', async () => {
    window.history.pushState({}, '', '/owned-items')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add owned item' }))
    const form = screen.getByRole('form', { name: 'Add owned item' })

    await user.type(within(form).getByLabelText('Item name'), 'Shelf B1 Note')
    await user.selectOptions(
      within(form).getByLabelText('Existing release'),
      'selected-ambient-works-85-92',
    )
    await user.click(screen.getByRole('button', { name: 'Add record' }))

    const detailPanel = screen.getByRole('complementary', {
      name: 'Shelf B1 Note',
    })

    expect(
      within(detailSection(detailPanel, 'Linked catalog item')).getByRole(
        'link',
        {
          name: 'Selected Ambient Works 85-92',
        },
      ),
    ).toHaveAttribute('href', '/releases?release=selected-ambient-works-85-92')
  })

  it('lets existing release selection be cleared and replaced by free text in manual forms', async () => {
    window.history.pushState({}, '', '/owned-items')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add owned item' }))
    const form = screen.getByRole('form', { name: 'Add owned item' })
    const releaseSelect = within(form).getByLabelText('Existing release')
    const releaseInput = within(form).getByLabelText('Linked release')

    await user.type(within(form).getByLabelText('Item name'), 'Unfiled Copy')
    await user.selectOptions(releaseSelect, 'selected-ambient-works-85-92')

    expect(releaseInput).toBeDisabled()

    await user.selectOptions(releaseSelect, '')
    await user.type(releaseInput, 'Desk Reference Tape')
    await user.click(screen.getByRole('button', { name: 'Add record' }))

    const detailPanel = screen.getByRole('complementary', {
      name: 'Unfiled Copy',
    })

    expect(
      within(detailSection(detailPanel, 'Linked catalog item')).getByText(
        'Desk Reference Tape',
      ),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).queryByRole('link', { name: 'Desk Reference Tape' }),
    ).not.toBeInTheDocument()
  })

  it('renders the relations workspace with graph rows and selected detail', () => {
    window.history.pushState({}, '', '/relations')

    render(<App />)

    expect(
      screen.getByRole('region', { name: 'Relations workspace' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: 'Search relations' }),
    ).toBeVisible()
    expect(
      screen.getByRole('row', { name: /richard d. james aphex twin/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('complementary', {
        name: 'Richard D. James to Aphex Twin',
      }),
    ).toBeInTheDocument()
  })

  it('filters relations by source, target, type, role, release, track and context hints', async () => {
    window.history.pushState({}, '', '/relations')
    const user = userEvent.setup()
    render(<App />)

    await user.type(
      screen.getByRole('searchbox', { name: 'Search relations' }),
      'dfa remixer lcd soundsystem yeah',
    )

    expect(
      screen.getByRole('row', { name: /the dfa lcd soundsystem/i }),
    ).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /richard d. james aphex twin/i }),
    ).not.toBeInTheDocument()
  })

  it('updates relation detail when a relation row is selected', async () => {
    window.history.pushState({}, '', '/relations')
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      screen.getByRole('button', { name: /the dfa lcd soundsystem/i }),
    )

    const detailPanel = screen.getByRole('complementary', {
      name: 'The DFA to LCD Soundsystem',
    })

    expect(
      within(detailPanel).getByRole('heading', {
        name: 'The DFA to LCD Soundsystem',
      }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getAllByText('Remixer').length,
    ).toBeGreaterThanOrEqual(2)
    expect(
      within(detailPanel).getAllByText('Yeah (Pretentious Mix)').length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('restores the current relation selection when a cleared search makes it visible again', async () => {
    window.history.pushState({}, '', '/relations')
    const user = userEvent.setup()
    render(<App />)

    const searchbox = screen.getByRole('searchbox', {
      name: 'Search relations',
    })

    await user.type(searchbox, 'dfa remixer')

    expect(
      screen.getByRole('complementary', {
        name: 'The DFA to LCD Soundsystem',
      }),
    ).toBeInTheDocument()

    await user.clear(searchbox)

    expect(
      screen.getByRole('complementary', {
        name: 'Richard D. James to Aphex Twin',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('row', { name: /richard d. james aphex twin/i }),
    ).toHaveAttribute('aria-selected', 'true')
  })

  it('shows endpoints, relation context, linked evidence and search hints as separate relation detail sections', () => {
    window.history.pushState({}, '', '/relations')

    render(<App />)

    const detailPanel = screen.getByRole('complementary', {
      name: 'Richard D. James to Aphex Twin',
    })

    expect(
      within(detailPanel).getByRole('heading', { name: 'Endpoints' }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', { name: 'Relation context' }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', { name: 'Linked evidence' }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByRole('heading', { name: 'Search hints' }),
    ).toBeInTheDocument()
    expect(within(detailPanel).getAllByText('Alias')).toHaveLength(3)
    expect(
      within(detailPanel).getAllByRole('link', { name: 'Aphex Twin' })[0],
    ).toHaveAttribute('href', '/artists?artist=aphex-twin')
  })

  it('links existing relation endpoints and linked evidence to their real catalog routes', async () => {
    window.history.pushState({}, '', '/relations')
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      screen.getByRole('button', {
        name: /blue monday 12-inch vinyl blue monday/i,
      }),
    )

    const detailPanel = screen.getByRole('complementary', {
      name: 'Blue Monday 12-inch vinyl to Blue Monday',
    })

    expect(
      within(detailSection(detailPanel, 'Endpoints')).getByRole('link', {
        name: 'Blue Monday 12-inch vinyl',
      }),
    ).toHaveAttribute('href', '/owned-items?ownedItem=blue-monday-vinyl')
    expect(
      within(detailSection(detailPanel, 'Endpoints')).getByRole('link', {
        name: 'Blue Monday',
      }),
    ).toHaveAttribute('href', '/releases?release=blue-monday')
    expect(
      within(detailSection(detailPanel, 'Linked evidence')).getByRole('link', {
        name: 'Blue Monday',
      }),
    ).toHaveAttribute('href', '/releases?release=blue-monday')
  })

  it('keeps unknown relation endpoints and linked evidence as plain text', async () => {
    window.history.pushState({}, '', '/relations')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add relation' }))
    const form = screen.getByRole('form', { name: 'Add relation' })

    await user.type(within(form).getByLabelText('Source'), 'Unfiled Person')
    await user.type(within(form).getByLabelText('Target'), 'Unfiled Project')
    await user.type(
      within(form).getByLabelText('Linked entity'),
      'Loose Sleeve Note',
    )
    await user.click(screen.getByRole('button', { name: 'Add record' }))

    const detailPanel = screen.getByRole('complementary', {
      name: 'Unfiled Person to Unfiled Project',
    })

    expect(
      within(detailSection(detailPanel, 'Endpoints')).getByText(
        'Unfiled Person',
      ),
    ).toBeInTheDocument()
    expect(
      within(detailSection(detailPanel, 'Endpoints')).getByText(
        'Unfiled Project',
      ),
    ).toBeInTheDocument()
    expect(
      within(detailSection(detailPanel, 'Linked evidence')).getByText(
        'Loose Sleeve Note',
      ),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).queryByRole('link', { name: 'Unfiled Person' }),
    ).not.toBeInTheDocument()
    expect(
      within(detailPanel).queryByRole('link', { name: 'Unfiled Project' }),
    ).not.toBeInTheDocument()
    expect(
      within(detailPanel).queryByRole('link', { name: 'Loose Sleeve Note' }),
    ).not.toBeInTheDocument()
  })

  it('lets a manual relation select existing catalog records and stores real links', async () => {
    window.history.pushState({}, '', '/relations')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add relation' }))
    const form = screen.getByRole('form', { name: 'Add relation' })

    await user.selectOptions(
      within(form).getByLabelText('Existing source'),
      'artist:aphex-twin',
    )
    await user.selectOptions(
      within(form).getByLabelText('Existing target'),
      'release:selected-ambient-works-85-92',
    )
    await user.selectOptions(
      within(form).getByLabelText('Existing linked entity'),
      'track:polynomial-c',
    )
    await user.type(within(form).getByLabelText('Relation type'), 'Appears on')
    await user.type(within(form).getByLabelText('Role'), 'Main artist')
    await user.click(screen.getByRole('button', { name: 'Add record' }))

    const detailPanel = screen.getByRole('complementary', {
      name: 'Aphex Twin to Selected Ambient Works 85-92',
    })

    expect(
      within(detailSection(detailPanel, 'Endpoints')).getByRole('link', {
        name: 'Aphex Twin',
      }),
    ).toHaveAttribute('href', '/artists?artist=aphex-twin')
    expect(
      within(detailSection(detailPanel, 'Endpoints')).getByRole('link', {
        name: 'Selected Ambient Works 85-92',
      }),
    ).toHaveAttribute('href', '/releases?release=selected-ambient-works-85-92')
    expect(
      within(detailSection(detailPanel, 'Linked evidence')).getByRole('link', {
        name: 'Polynomial-C',
      }),
    ).toHaveAttribute('href', '/tracks?track=polynomial-c')
  })

  it('creates a release with no tracks and keeps track search unchanged for that title', async () => {
    window.history.pushState({}, '', '/releases')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add release' }))
    const form = screen.getByRole('form', { name: 'Add release' })

    await user.type(
      within(form).getByLabelText('Title'),
      'No Track Shell Release',
    )
    await user.click(screen.getByRole('button', { name: 'Add record' }))

    expect(
      screen.getByRole('complementary', { name: 'No Track Shell Release' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Tracks' }))
    await user.type(
      screen.getByRole('searchbox', { name: 'Search tracks' }),
      'No Track Shell Release',
    )

    expect(screen.getByText('0 shown')).toBeInTheDocument()
  })

  it('creates a release with draft tracks that appear in Tracks and link back to the release', async () => {
    window.history.pushState({}, '', '/releases')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add release' }))
    const form = screen.getByRole('form', { name: 'Add release' })

    await user.type(within(form).getByLabelText('Title'), 'Basement Dub Plate')
    await user.selectOptions(
      within(form).getByLabelText('Existing artist'),
      'new-order',
    )
    await user.click(
      within(form).getByRole('button', { name: 'Add track row' }),
    )
    await user.type(
      within(form).getByLabelText('Draft track 1 title'),
      'Basement Dub A',
    )
    await user.type(
      within(form).getByLabelText('Draft track 1 duration'),
      '05:12',
    )
    await user.type(
      within(form).getByLabelText('Draft track 1 file format'),
      'WAV',
    )
    await user.click(
      within(form).getByRole('button', { name: 'Add track row' }),
    )
    await user.type(
      within(form).getByLabelText('Draft track 2 title'),
      'Basement Dub B',
    )
    await user.click(screen.getByRole('button', { name: 'Add record' }))

    const releasePanel = screen.getByRole('complementary', {
      name: 'Basement Dub Plate',
    })
    const tracksSection = detailSection(releasePanel, 'Tracks')

    expect(within(tracksSection).getByText('2 tracks')).toBeInTheDocument()
    expect(
      within(tracksSection).getByText('Basement Dub A'),
    ).toBeInTheDocument()
    expect(
      within(tracksSection).getByText('Basement Dub B'),
    ).toBeInTheDocument()

    await user.click(
      within(tracksSection).getByRole('link', { name: 'Basement Dub A' }),
    )

    expect(
      within(screen.getByRole('banner')).getByRole('heading', {
        name: 'Tracks',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('complementary', { name: 'Basement Dub A' }),
    ).toBeInTheDocument()

    await user.type(
      screen.getByRole('searchbox', { name: 'Search tracks' }),
      'Basement Dub',
    )

    expect(screen.getByRole('row', { name: /basement dub a/i })).toBeVisible()
    expect(screen.getByRole('row', { name: /basement dub b/i })).toBeVisible()

    await user.click(screen.getByRole('button', { name: /basement dub a/i }))

    const trackPanel = screen.getByRole('complementary', {
      name: 'Basement Dub A',
    })

    expect(
      within(detailSection(trackPanel, 'Linked release')).getByRole('link', {
        name: 'Basement Dub Plate',
      }),
    ).toHaveAttribute('href', expect.stringContaining('/releases?release='))
  })

  it('uses SPA detail links so manual in-memory records survive cross-workspace navigation', async () => {
    window.history.pushState({}, '', '/releases')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add release' }))
    const form = screen.getByRole('form', { name: 'Add release' })

    await user.type(within(form).getByLabelText('Title'), 'One Session Link')
    await user.click(
      within(form).getByRole('button', { name: 'Add track row' }),
    )
    await user.type(
      within(form).getByLabelText('Draft track 1 title'),
      'One Session Track',
    )
    await user.click(screen.getByRole('button', { name: 'Add record' }))

    const releasePanel = screen.getByRole('complementary', {
      name: 'One Session Link',
    })

    await user.click(
      within(detailSection(releasePanel, 'Tracks')).getByRole('link', {
        name: 'One Session Track',
      }),
    )

    const trackPanel = screen.getByRole('complementary', {
      name: 'One Session Track',
    })

    await user.click(
      within(detailSection(trackPanel, 'Linked release')).getByRole('link', {
        name: 'One Session Link',
      }),
    )

    expect(
      within(screen.getByRole('banner')).getByRole('heading', {
        name: 'Releases',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('complementary', { name: 'One Session Link' }),
    ).toBeInTheDocument()
  })

  it('blocks release submit when a non-empty draft track row has no title', async () => {
    window.history.pushState({}, '', '/releases')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add release' }))
    const form = screen.getByRole('form', { name: 'Add release' })

    await user.type(
      within(form).getByLabelText('Title'),
      'Invalid Draft Track Release',
    )
    await user.click(
      within(form).getByRole('button', { name: 'Add track row' }),
    )
    await user.type(
      within(form).getByLabelText('Draft track 1 duration'),
      '03:33',
    )

    expect(screen.getByRole('button', { name: 'Add record' })).toBeDisabled()
    expect(
      within(form).getByText(
        'Draft track rows with metadata need a track title.',
      ),
    ).toBeInTheDocument()
  })

  it('does not add a release or draft tracks when release entry is canceled', async () => {
    window.history.pushState({}, '', '/releases')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add release' }))
    const form = screen.getByRole('form', { name: 'Add release' })

    await user.type(
      within(form).getByLabelText('Title'),
      'Canceled Release Shell',
    )
    await user.click(
      within(form).getByRole('button', { name: 'Add track row' }),
    )
    await user.type(
      within(form).getByLabelText('Draft track 1 title'),
      'Canceled Draft Track',
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(
      screen.queryByRole('row', { name: /canceled release shell/i }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Tracks' }))
    await user.type(
      screen.getByRole('searchbox', { name: 'Search tracks' }),
      'Canceled Draft Track',
    )

    expect(screen.getByText('0 shown')).toBeInTheDocument()
  })

  it('renders the settings workspace with configuration rows and selected detail', () => {
    window.history.pushState({}, '', '/settings')

    render(<App />)

    expect(
      screen.getByRole('region', { name: 'Settings workspace' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: 'Search settings' }),
    ).toBeVisible()
    expect(screen.getByRole('row', { name: /collection name/i })).toBeVisible()
    expect(
      screen.getByRole('row', { name: /default media type/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('row', { name: /preferred export formats/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('complementary', { name: 'Collection name' }),
    ).toBeInTheDocument()
  })

  it('filters settings by name, category, value, policy, media, ownership, export and privacy terms', async () => {
    window.history.pushState({}, '', '/settings')
    const user = userEvent.setup()
    render(<App />)

    await user.type(
      screen.getByRole('searchbox', { name: 'Search settings' }),
      'private access local account',
    )

    expect(screen.getByRole('row', { name: /privacy mode/i })).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /default media type/i }),
    ).not.toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox', { name: 'Search settings' }))
    await user.type(
      screen.getByRole('searchbox', { name: 'Search settings' }),
      'csv json export',
    )

    expect(
      screen.getByRole('row', { name: /preferred export formats/i }),
    ).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /privacy mode/i }),
    ).not.toBeInTheDocument()
  })

  it('updates settings detail when a setting row is selected', async () => {
    window.history.pushState({}, '', '/settings')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /metadata policy/i }))

    const detailPanel = screen.getByRole('complementary', {
      name: 'Metadata policy',
    })

    expect(
      within(detailPanel).getByRole('heading', { name: 'Metadata policy' }),
    ).toBeInTheDocument()
    expect(
      within(detailPanel).getByText(
        'Prefer embedded file tags during local folder scans.',
      ),
    ).toBeInTheDocument()
  })

  it('shows all required settings detail sections', () => {
    window.history.pushState({}, '', '/settings')

    render(<App />)

    const detailPanel = screen.getByRole('complementary', {
      name: 'Collection name',
    })

    for (const heading of [
      'Collection identity',
      'Metadata defaults',
      'Import and export preferences',
      'Privacy and access',
      'Dangerous actions',
    ]) {
      expect(
        within(detailPanel).getByRole('heading', { name: heading }),
      ).toBeInTheDocument()
    }
  })

  it('updates visible settings mock state from local controls', async () => {
    window.history.pushState({}, '', '/settings')
    const user = userEvent.setup()
    render(<App />)

    await user.selectOptions(
      screen.getByLabelText('Default media type'),
      'Vinyl',
    )
    await user.selectOptions(
      screen.getByLabelText('Default ownership status'),
      'Wanted',
    )
    await user.click(screen.getByLabelText('CSV'))

    expect(
      screen.getByRole('row', { name: /default media type/i }),
    ).toHaveTextContent('Vinyl')
    expect(
      screen.getByRole('row', { name: /default ownership status/i }),
    ).toHaveTextContent('Wanted')
    expect(
      screen.getByRole('row', { name: /preferred export formats/i }),
    ).toHaveTextContent('JSON')
    expect(
      screen.getByRole('row', { name: /preferred export formats/i }),
    ).not.toHaveTextContent('CSV')
  })

  it('keeps dangerous settings actions non-destructive and gated', async () => {
    window.history.pushState({}, '', '/settings')
    const user = userEvent.setup()
    render(<App />)

    expect(
      screen.getByRole('button', { name: 'Delete collection' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Reset mock settings' }),
    ).toBeDisabled()

    await user.selectOptions(
      screen.getByLabelText('Default media type'),
      'Vinyl',
    )
    await user.click(screen.getByLabelText('CSV'))
    await user.click(
      screen.getByLabelText('I understand this is a local mock confirmation.'),
    )
    await user.click(
      screen.getByRole('button', { name: 'Reset mock settings' }),
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Mock settings were reset to defaults. No collection data was deleted.',
    )
    expect(
      screen.getByRole('row', { name: /default media type/i }),
    ).toHaveTextContent('Digital')
    expect(
      screen.getByRole('row', { name: /preferred export formats/i }),
    ).toHaveTextContent('JSON, CSV')
    expect(
      screen.getByRole('button', { name: 'Reset mock settings' }),
    ).toBeDisabled()
    expect(
      screen.getByLabelText('I understand this is a local mock confirmation.'),
    ).not.toBeChecked()
    expect(
      screen.getByRole('row', { name: /collection name/i }),
    ).toBeInTheDocument()
  })

  it('exposes the workspace header as a banner landmark', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: 'Settings' }))

    expect(
      within(screen.getByRole('banner')).getByText('Default collection'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('banner')).getByRole('heading', {
        name: 'Settings',
      }),
    ).toBeInTheDocument()
  })

  it('keeps sidebar and header behavior when navigating to settings', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: 'Settings' }))

    expect(
      screen.getByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('banner')).getByText('Default collection'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      within(screen.getByRole('banner')).queryByRole('button'),
    ).not.toBeInTheDocument()
  })

  it('filters catalog rows by media, status and relation text', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.selectOptions(
      screen.getByLabelText('Catalog entity type'),
      'Track',
    )
    await user.selectOptions(
      screen.getByLabelText('Catalog entity type'),
      'Track',
    )
    await user.type(screen.getByRole('searchbox'), 'lossless')

    expect(screen.getByRole('row', { name: /polynomial-c/i })).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /blue monday/i }),
    ).not.toBeInTheDocument()
  })

  it('keeps the detail panel in sync with filtered results', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.selectOptions(
      screen.getByLabelText('Catalog entity type'),
      'Track',
    )
    await user.type(screen.getByRole('searchbox'), 'lossless')

    const detailPanel = screen.getByRole('complementary', {
      name: 'Polynomial-C',
    })

    expect(
      within(detailPanel).getByRole('heading', { name: 'Polynomial-C' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('complementary', {
        name: 'Selected Ambient Works 85-92',
      }),
    ).not.toBeInTheDocument()
  })

  it('shows an empty detail state when no catalog rows match', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByRole('searchbox'), 'no matching catalog item')

    expect(screen.getByText('0 shown')).toBeInTheDocument()
    expect(screen.getByText('No matching catalog entries.')).toBeInTheDocument()
  })

  it('applies saved-view filters to catalog rows', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Needs digitization' }))

    expect(
      screen.getByRole('button', { name: 'Needs digitization' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('row', { name: /blue monday/i }).length).toBe(2)
    expect(
      screen.queryByRole('row', { name: /polynomial-c/i }),
    ).not.toBeInTheDocument()
  })

  it('updates the detail panel when a catalog row is selected', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      screen.getByRole('button', {
        name: 'Select catalog owned item Blue Monday',
      }),
    )

    const detailPanel = screen.getByRole('complementary', {
      name: 'Blue Monday',
    })

    expect(
      within(detailPanel).getByRole('heading', { name: 'Blue Monday' }),
    ).toBeInTheDocument()
    expect(within(detailPanel).getByText('12-inch vinyl')).toBeInTheDocument()
    expect(within(detailPanel).getByText('Shelf A3')).toBeInTheDocument()
  })

  it('derives catalog rows from manual session records and deep-links with SPA navigation', async () => {
    window.history.pushState({}, '', '/artists')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add artist' }))
    await user.type(screen.getByLabelText('Name'), 'Catalog Session Artist')
    await user.type(screen.getByLabelText('Primary credit role'), 'Archivist')
    await user.click(screen.getByRole('button', { name: 'Add record' }))

    await user.click(screen.getByRole('link', { name: 'Catalog' }))
    await user.type(
      screen.getByRole('searchbox', { name: 'Search collection' }),
      'Catalog Session Artist Archivist',
    )

    expect(
      screen.getByRole('row', { name: /catalog session artist/i }),
    ).toBeVisible()

    await user.click(
      screen.getByRole('link', { name: 'Open Catalog Session Artist' }),
    )

    expect(window.location.pathname).toBe('/artists')
    expect(
      screen.getByRole('complementary', { name: 'Catalog Session Artist' }),
    ).toBeInTheDocument()
  })

  it('searches catalog linked metadata and keeps unknown free text as plain text', async () => {
    window.history.pushState({}, '', '/relations')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add relation' }))
    const form = screen.getByRole('form', { name: 'Add relation' })

    await user.type(within(form).getByLabelText('Source'), 'Loose Note Person')
    await user.type(within(form).getByLabelText('Target'), 'Loose Note Alias')
    await user.type(
      within(form).getByLabelText('Linked entity'),
      'Sleeve-only white label clue',
    )
    await user.click(screen.getByRole('button', { name: 'Add record' }))

    await user.click(screen.getByRole('link', { name: 'Catalog' }))
    await user.type(
      screen.getByRole('searchbox', { name: 'Search collection' }),
      'Sleeve-only white label clue',
    )

    const detailPanel = screen.getByRole('complementary', {
      name: 'Loose Note Person to Loose Note Alias',
    })

    expect(
      within(detailPanel).getAllByText('Sleeve-only white label clue')[0],
    ).toBeInTheDocument()
    expect(
      within(detailPanel).queryByRole('link', {
        name: 'Sleeve-only white label clue',
      }),
    ).not.toBeInTheDocument()
  })

  it('narrows catalog rows with relation-aware filters', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.selectOptions(
      screen.getByLabelText('Catalog entity type'),
      'Track',
    )
    await user.selectOptions(screen.getByLabelText('File format'), 'FLAC')

    expect(screen.getByRole('row', { name: /polynomial-c/i })).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /selected ambient works 85-92/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('row', { name: /blue monday vinyl/i }),
    ).not.toBeInTheDocument()
  })

  it('derives release catalog statuses from every owned copy', () => {
    const entries = buildCatalogEntries({
      artists: [],
      releases: [
        {
          id: 'mixed-copy-release',
          title: 'Mixed Copy Release',
          artist: 'Catalog Tester',
          type: 'Album',
          year: '2026',
          label: 'Test Label',
          genres: [],
          tags: [],
          releaseNotes: 'Release with multiple concrete copy states.',
          ownedCopies: [
            {
              id: 'mixed-copy-owned',
              medium: 'CD',
              status: 'Owned',
              storage: 'Shelf A',
              condition: 'Very Good',
              note: 'Cataloged copy.',
            },
            {
              id: 'mixed-copy-transfer',
              medium: 'Cassette',
              status: 'Needs digitization',
              storage: 'Shelf B',
              condition: 'Good',
              note: 'Transfer pending.',
            },
          ],
        },
      ],
      tracks: [],
      ownedItems: [],
      relations: [],
      playlists: [],
    })
    const releaseEntry = entries.find(
      (entry) => entry.id === 'release:mixed-copy-release',
    )

    expect(releaseEntry?.statuses).toEqual(['Owned', 'Needs digitization'])
    expect(releaseEntry?.status).toBe('Owned, Needs digitization')
    expect(releaseEntry?.statusTone).toBe('amber')
  })

  it('shows duplicate warnings for manual records without blocking submit', async () => {
    window.history.pushState({}, '', '/artists')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add artist' }))
    await user.type(screen.getByLabelText('Name'), 'Aphex Twin')

    expect(screen.getByText(/likely duplicate artist/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add record' }))

    expect(
      screen.getAllByRole('row', { name: /aphex twin/i }).length,
    ).toBeGreaterThan(1)
  })

  it('filters track versions and warns on duplicate tracks when artist comes from the selected release', async () => {
    window.history.pushState({}, '', '/tracks')
    const user = userEvent.setup()
    render(<App />)

    await user.selectOptions(
      screen.getByLabelText('Version or relation type'),
      'Album version',
    )

    expect(screen.getByRole('row', { name: /polynomial-c/i })).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /yeah pretentious mix/i }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add track' }))
    const form = screen.getByRole('form', { name: 'Add track' })

    await user.type(within(form).getByLabelText('Title'), 'Polynomial-C')
    await user.selectOptions(
      within(form).getByLabelText('Existing release'),
      'selected-ambient-works-85-92',
    )

    expect(screen.getByText(/likely duplicate track/i)).toBeInTheDocument()

    await user.selectOptions(
      screen.getByLabelText('Version or relation type'),
      '',
    )
    await user.click(screen.getByRole('button', { name: 'Add record' }))

    expect(
      screen.getAllByRole('row', { name: /polynomial-c/i }).length,
    ).toBeGreaterThan(1)
  })

  it('filters manual releases and keeps draft track backlinks linked after duplicate warnings remain non-blocking', async () => {
    window.history.pushState({}, '', '/releases')
    const user = userEvent.setup()
    render(<App />)

    await user.selectOptions(screen.getByLabelText('Label'), 'Warp')

    expect(
      screen.getByRole('row', { name: /selected ambient works 85-92/i }),
    ).toBeVisible()
    expect(
      screen.queryByRole('row', { name: /blue monday/i }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add release' }))
    let form = screen.getByRole('form', { name: 'Add release' })

    await user.type(within(form).getByLabelText('Title'), 'Blue Monday')
    await user.selectOptions(
      within(form).getByLabelText('Existing artist'),
      'new-order',
    )

    expect(screen.getByText(/likely duplicate release/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.selectOptions(screen.getByLabelText('Label'), '')
    await user.click(screen.getByRole('button', { name: 'Add release' }))
    form = screen.getByRole('form', { name: 'Add release' })

    await user.type(within(form).getByLabelText('Title'), 'Review Shelf Dub')
    await user.type(within(form).getByLabelText('Artist'), 'Review Artist')
    await user.type(within(form).getByLabelText('Label'), 'Review Label')
    await user.type(within(form).getByLabelText('Media'), 'Digital')
    await user.click(
      within(form).getByRole('button', { name: 'Add track row' }),
    )
    await user.type(
      within(form).getByLabelText('Draft track 1 title'),
      'Review Shelf Dub Version',
    )
    await user.type(
      within(form).getByLabelText('Draft track 1 file format'),
      'FLAC',
    )

    await user.click(screen.getByRole('button', { name: 'Add record' }))
    await user.selectOptions(screen.getByLabelText('Label'), 'Review Label')

    expect(screen.getByRole('row', { name: /review shelf dub/i })).toBeVisible()

    const releasePanel = screen.getByRole('complementary', {
      name: 'Review Shelf Dub',
    })
    const tracksSection = detailSection(releasePanel, 'Tracks')

    expect(
      within(tracksSection).getByRole('link', {
        name: 'Review Shelf Dub Version',
      }),
    ).toHaveAttribute('href', expect.stringContaining('/tracks?track='))
  })

  it('updates release backlinks immediately after a manual owned item is created', async () => {
    window.history.pushState({}, '', '/owned-items')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add owned item' }))
    const form = screen.getByRole('form', { name: 'Add owned item' })

    await user.type(within(form).getByLabelText('Item name'), 'Session CD Copy')
    await user.selectOptions(
      within(form).getByLabelText('Existing release'),
      'selected-ambient-works-85-92',
    )
    await user.type(within(form).getByLabelText('Storage location'), 'Desk A1')
    await user.click(screen.getByRole('button', { name: 'Add record' }))

    await user.click(
      within(
        detailSection(
          screen.getByRole('complementary', { name: 'Session CD Copy' }),
          'Linked catalog item',
        ),
      ).getByRole('link', { name: 'Selected Ambient Works 85-92' }),
    )

    const releasePanel = screen.getByRole('complementary', {
      name: 'Selected Ambient Works 85-92',
    })

    expect(
      within(detailSection(releasePanel, 'Owned item backlinks')).getByRole(
        'link',
        { name: 'Session CD Copy' },
      ),
    ).toHaveAttribute(
      'href',
      expect.stringContaining('/owned-items?ownedItem='),
    )
  })
})

function detailSection(panel: HTMLElement, headingName: string) {
  const heading = within(panel).getByRole('heading', { name: headingName })
  const section = heading.closest('section')

  if (!section) {
    throw new Error(`Missing detail section for heading: ${headingName}`)
  }

  return section
}

async function addManualArtist(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(screen.getByRole('button', { name: 'Add artist' }))
  const form = screen.getByRole('form', { name: 'Add artist' })
  await user.type(within(form).getByLabelText('Name'), name)
  await user.click(within(form).getByRole('button', { name: 'Add record' }))
}

async function selectVisibleOption(
  user: ReturnType<typeof userEvent.setup>,
  select: HTMLElement,
  name: string,
) {
  await user.selectOptions(select, within(select).getByRole('option', { name }))
}
