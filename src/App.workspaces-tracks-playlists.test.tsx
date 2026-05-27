import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App track and playlist workspaces', () => {
  it('renders the tracks workspace with track rows and selected detail', () => {
    window.history.pushState({}, '', '/tracks')

    h.render(<h.App />)

    expect(
      h.screen.getByRole('region', { name: 'Tracks workspace' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('searchbox', { name: 'Search tracks' }),
    ).toBeVisible()
    expect(h.screen.getByRole('row', { name: /polynomial-c/i })).toBeVisible()
    expect(
      h.screen.getByRole('complementary', { name: 'Polynomial-C' }),
    ).toBeInTheDocument()
  })

  it('filters tracks by title, artist, release, duration, credits, versions, relations and file format', async () => {
    window.history.pushState({}, '', '/tracks')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search tracks' }),
      'new order 07:29 factory version wav',
    )

    expect(h.screen.getByRole('row', { name: /blue monday/i })).toBeVisible()
    expect(
      h.screen.queryByRole('row', { name: /polynomial-c/i }),
    ).not.toBeInTheDocument()
  })

  it('updates track detail when a track row is selected', async () => {
    window.history.pushState({}, '', '/tracks')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: /blue monday/i }))

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Blue Monday',
    })

    expect(
      h.within(detailPanel).getByRole('heading', { name: 'Blue Monday' }),
    ).toBeInTheDocument()
    expect(h.within(detailPanel).getAllByText('New Order')).toHaveLength(4)
    expect(h.within(detailPanel).getByText(/factory/i)).toBeInTheDocument()
  })

  it('shows release link, credits, relations and file metadata as separate track detail sections', () => {
    window.history.pushState({}, '', '/tracks')

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Polynomial-C',
    })

    expect(
      h
        .within(detailPanel)
        .getByRole('heading', { name: 'Release appearances' }),
    ).toBeInTheDocument()
    expect(
      h.within(detailPanel).getByRole('link', {
        name: 'Selected Ambient Works 85-92',
      }),
    ).toHaveAttribute('href', '/releases?release=selected-ambient-works-85-92')
    expect(
      h.within(detailPanel).getByRole('heading', { name: 'Track credits' }),
    ).toBeInTheDocument()
    expect(
      h.within(detailPanel).getByRole('heading', {
        name: 'Versions and relations',
      }),
    ).toBeInTheDocument()
    expect(
      h
        .within(detailPanel)
        .getByRole('heading', { name: 'Local file metadata' }),
    ).toBeInTheDocument()
    expect(h.within(detailPanel).getByText('FLAC')).toBeInTheDocument()
    expect(
      h.within(detailPanel).getByText('44.1 kHz / 16-bit'),
    ).toBeInTheDocument()
  })

  it('links track version targets and relation records when relation ids are known', () => {
    window.history.pushState({}, '', '/tracks?track=linked-remix')
    h.seedCatalogForTests({
      artists: h.artistRecords,
      releases: h.releaseRecords,
      tracks: [
        {
          ...h.trackRecords[0],
          id: 'original-track',
          title: 'Original Mix',
        },
        {
          ...h.trackRecords[2],
          id: 'linked-remix',
          title: 'Linked Remix',
          relations: [
            {
              type: 'Remix of',
              target: 'Original Mix',
              targetId: 'original-track',
              relationId: 'track-relation-link',
              detail: 'Remix connected to the original track.',
            },
          ],
        },
      ],
      ownedItems: [],
      relations: [
        {
          id: 'track-relation-link',
          source: 'Linked Remix',
          sourceLink: { kind: 'track', id: 'linked-remix' },
          sourceType: 'Track',
          target: 'Original Mix',
          targetLink: { kind: 'track', id: 'original-track' },
          targetType: 'Track',
          relationType: 'Remix of',
          role: 'Remix of',
          context: 'Remix connected to the original track.',
          evidence: 'Manual relation',
          linkedEntity: 'Original Mix',
          linkedEntityLink: { kind: 'track', id: 'original-track' },
          linkedEntityType: 'Track',
          direction: 'Track relation',
          searchHints: ['remix'],
        },
      ],
      playlists: [],
    })

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Linked Remix',
    })
    const relations = h.detailSection(detailPanel, 'Versions and relations')

    expect(
      h.within(relations).getByRole('link', { name: 'Original Mix' }),
    ).toHaveAttribute('href', '/tracks?track=original-track')
    expect(
      h.within(relations).getByRole('link', { name: 'Relation record' }),
    ).toHaveAttribute('href', '/relations?relation=track-relation-link')
  })

  it('renders an existing linked release in track detail as a navigable release link', () => {
    window.history.pushState({}, '', '/tracks')

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Polynomial-C',
    })

    expect(
      h
        .within(h.detailSection(detailPanel, 'Release appearances'))
        .getByRole('link', {
          name: 'Selected Ambient Works 85-92',
        }),
    ).toHaveAttribute('href', '/releases?release=selected-ambient-works-85-92')
  })

  it('shows release cover thumbnails in track release appearances', () => {
    h.seedCatalogWithSelectedAmbientCover()
    window.history.pushState({}, '', '/tracks?track=polynomial-c')

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Polynomial-C',
    })

    expect(
      h
        .within(h.detailSection(detailPanel, 'Release appearances'))
        .getByRole('img', {
          name: 'Selected Ambient Works 85-92 cover thumbnail',
        }),
    ).toHaveAttribute(
      'src',
      '/api/releases/selected-ambient-works-85-92/cover-image',
    )
  })

  it('keeps release appearances read-only in the manual track form', async () => {
    window.history.pushState({}, '', '/tracks')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add track' }))
    const form = h.screen.getByRole('form', { name: 'Add track' })

    await user.type(h.within(form).getByLabelText('Title'), 'Shelf Index Dub')
    await user.type(h.within(form).getByLabelText('Artist'), 'Aphex Twin')
    await user.click(h.within(form).getByRole('button', { name: 'Add artist' }))

    expect(
      h.within(form).queryByLabelText('Existing release'),
    ).not.toBeInTheDocument()
    expect(
      h.within(form).queryByRole('button', { name: 'Add release' }),
    ).not.toBeInTheDocument()
    expect(
      h.within(form).getByText('This track is not attached to a release yet.'),
    ).toBeInTheDocument()

    await user.click(h.screen.getByRole('button', { name: 'Add record' }))

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Shelf Index Dub',
    })

    expect(
      h.within(detailPanel).getAllByText('Aphex Twin').length,
    ).toBeGreaterThan(0)
    expect(
      h
        .within(h.detailSection(detailPanel, 'Release appearances'))
        .getByText('No release appearances recorded.'),
    ).toBeVisible()
  })

  it('renders the playlists workspace with manual and smart playlist rows', () => {
    window.history.pushState({}, '', '/playlists')

    h.render(<h.App />)

    expect(
      h.screen.getByRole('region', { name: 'Playlists workspace' }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('searchbox', { name: 'Search playlists' }),
    ).toBeVisible()
    expect(
      h.screen.getByRole('row', { name: /late night lossless shelf/i }),
    ).toBeVisible()
    expect(
      h.screen.getByRole('row', { name: /lossless idm digital/i }),
    ).toBeVisible()
    expect(
      h.screen.getByRole('row', { name: /needs digitization physical/i }),
    ).toBeVisible()
    expect(
      h.screen.getByRole('complementary', {
        name: 'Late night lossless shelf',
      }),
    ).toBeInTheDocument()
  })

  it('filters playlists by name, type, track, artist, release, tags, year range, format, ownership and rule hints', async () => {
    window.history.pushState({}, '', '/playlists')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search playlists' }),
      'smart 1980-1989 new order vinyl needs digitization missing',
    )

    expect(
      h.screen.getByRole('row', { name: /needs digitization physical/i }),
    ).toBeVisible()
    expect(
      h.screen.queryByRole('row', { name: /late night lossless shelf/i }),
    ).not.toBeInTheDocument()
    expect(
      h.screen.queryByRole('row', { name: /lossless idm digital/i }),
    ).not.toBeInTheDocument()
  })

  it('updates playlist detail when a playlist row is selected', async () => {
    window.history.pushState({}, '', '/playlists')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(
      h.screen.getByRole('button', { name: /needs digitization physical/i }),
    )

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Needs digitization physical',
    })

    expect(
      h.within(detailPanel).getByRole('heading', {
        name: 'Needs digitization physical',
      }),
    ).toBeInTheDocument()
    expect(
      h.within(detailPanel).getAllByRole('link', { name: 'Blue Monday' })
        .length,
    ).toBeGreaterThan(0)
    expect(
      h
        .within(detailPanel)
        .getByText('Ownership status is Needs digitization.'),
    ).toBeInTheDocument()
  })

  it('shows manual track selection in manual playlist detail', () => {
    window.history.pushState({}, '', '/playlists')

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Late night lossless shelf',
    })

    expect(
      h
        .within(h.detailSection(detailPanel, 'Smart rules / manual selection'))
        .getByText('Manual track selection'),
    ).toBeInTheDocument()
    expect(
      h
        .within(h.detailSection(detailPanel, 'Smart rules / manual selection'))
        .getByText(/no automatic catalog rule/i),
    ).toBeInTheDocument()
  })

  it('shows readable rule criteria in smart playlist detail', async () => {
    window.history.pushState({}, '', '/playlists')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(
      h.screen.getByRole('button', { name: /lossless idm digital/i }),
    )

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Lossless IDM digital',
    })
    const rulesSection = h.detailSection(
      detailPanel,
      'Smart rules / manual selection',
    )

    expect(
      h
        .within(rulesSection)
        .getByText(
          'Tags and file criteria select lossless digital IDM tracks.',
        ),
    ).toBeInTheDocument()
    expect(
      h.within(rulesSection).getByText('File format is FLAC.'),
    ).toBeInTheDocument()
  })

  it('shows playlist tracks, linked releases and owned availability as separate detail sections', () => {
    window.history.pushState({}, '', '/playlists')

    h.render(<h.App />)

    const detailPanel = h.screen.getByRole('complementary', {
      name: 'Late night lossless shelf',
    })

    expect(
      h.within(detailPanel).getByRole('heading', {
        name: 'Playlist metadata',
      }),
    ).toBeInTheDocument()
    expect(
      h.within(detailPanel).getByRole('heading', { name: 'Tracks' }),
    ).toBeInTheDocument()
    expect(
      h.within(detailPanel).getByRole('heading', {
        name: 'Smart rules / manual selection',
      }),
    ).toBeInTheDocument()
    expect(
      h.within(detailPanel).getByRole('heading', {
        name: 'Linked releases and owned availability',
      }),
    ).toBeInTheDocument()
    expect(
      h.within(h.detailSection(detailPanel, 'Tracks')).getByRole('link', {
        name: 'Polynomial-C',
      }),
    ).toHaveAttribute('href', '/tracks?track=polynomial-c')
    expect(
      h.within(detailPanel).getAllByRole('link', {
        name: 'Selected Ambient Works 85-92',
      })[0],
    ).toHaveAttribute('href', '/releases?release=selected-ambient-works-85-92')
    expect(
      h
        .within(
          h.detailSection(
            detailPanel,
            'Linked releases and owned availability',
          ),
        )
        .getByText('Unfiled white label'),
    ).toBeInTheDocument()
    expect(
      h.within(detailPanel).queryByRole('link', {
        name: 'Unfiled white label',
      }),
    ).not.toBeInTheDocument()
    expect(h.within(detailPanel).getAllByText('Owned').length).toBeGreaterThan(
      0,
    )
    expect(
      h
        .within(detailPanel)
        .getByText('Digital library and CD shelf B1 are available.'),
    ).toBeInTheDocument()
  })

  it('shows an empty detail state when no playlists match the search query', async () => {
    window.history.pushState({}, '', '/playlists')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.type(
      h.screen.getByRole('searchbox', { name: 'Search playlists' }),
      'zzz no match at all',
    )

    expect(h.screen.getByText('0 shown')).toBeInTheDocument()
    expect(h.screen.getByText('No matching playlists.')).toBeInTheDocument()
  })
})
