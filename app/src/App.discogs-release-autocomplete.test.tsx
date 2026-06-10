import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App Discogs release autocomplete', () => {
  it('searches release candidates and prefills a new release only after review apply', async () => {
    window.history.pushState({}, '', '/releases')
    const fetchMock = h.vi.fn<Window['fetch']>().mockImplementation((input) => {
      const url = requestUrl(input)

      if (url.pathname === '/api/external-metadata/discogs/releases') {
        return Promise.resolve(
          h.jsonResponse({
            items: [
              {
                source: source('249504'),
                title: 'Blue Monday',
                artists: ['New Order'],
                year: 1983,
                labels: ['Factory'],
                formats: ['Vinyl', '12"'],
                catalogNumber: 'FAC 73',
                barcodes: ['5016839200371'],
              },
            ],
            limit: 25,
            total: 1,
          }),
        )
      }

      if (url.pathname === '/api/external-metadata/discogs/releases/249504') {
        return Promise.resolve(h.jsonResponse(releaseDetail()))
      }

      throw new Error(`Unexpected request: ${url.pathname}`)
    })
    h.vi.stubGlobal('fetch', fetchMock)
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(
      h.within(form).getByLabelText('Title'),
      'Local working title',
    )
    await user.click(
      h.within(form).getByRole('button', { name: 'Search Discogs' }),
    )

    const lookup = h.within(form).getByRole('region', {
      name: 'Discogs release lookup',
    })
    await user.click(
      h.within(lookup).getByRole('button', { name: 'Search Discogs releases' }),
    )
    const searchUrl = fetchMock.mock.calls
      .map(([input]) => requestUrl(input))
      .find((url) => url.pathname === '/api/external-metadata/discogs/releases')
    expect(searchUrl?.searchParams.get('barcode')).toBeNull()
    expect(h.within(lookup).queryByLabelText('Discogs barcode')).toBeNull()
    expect(h.within(lookup).queryByText('5016839200371')).toBeNull()
    expect(h.within(lookup).queryByText('Factory')).toBeNull()

    await user.click(
      await h.within(lookup).findByRole('button', {
        name: /review blue monday/i,
      }),
    )

    expect(h.within(form).getByLabelText('Title')).toHaveValue(
      'Local working title',
    )
    expect(
      await h.within(lookup).findByRole('heading', {
        name: 'Review Discogs candidate',
      }),
    ).toBeInTheDocument()
    expect(
      h.within(lookup).getAllByText('Data provided by Discogs.').length,
    ).toBeGreaterThan(0)
    expect(
      h.within(lookup).getByRole('link', { name: 'Open Discogs source' }),
    ).toHaveAttribute('href', 'https://www.discogs.com/release/249504')
    expect(h.within(lookup).queryByText(/Identifiers/i)).toBeNull()
    expect(h.within(lookup).queryByText(/Barcodes/i)).toBeNull()
    expect(h.within(lookup).queryByText(/External source/i)).toBeNull()
    expect(h.within(lookup).getByText('Written-By')).toBeInTheDocument()
    expect(h.within(lookup).queryByText('New role accepted')).toBeNull()
    expect(h.within(lookup).queryByText('Matched local artist')).toBeNull()

    await user.click(
      h.within(lookup).getByRole('button', {
        name: 'Apply selected Discogs fields',
      }),
    )

    expect(
      h.within(lookup).queryByRole('heading', {
        name: 'Review Discogs candidate',
      }),
    ).not.toBeInTheDocument()
    expect(
      h
        .within(lookup)
        .getByText(
          'Applied Discogs core, artists, labels, classification and tracklist to the form. Save record to persist changes.',
        ),
    ).toBeInTheDocument()
    expect(h.within(form).getByLabelText('Title')).toHaveValue('Blue Monday')
    expect(h.within(form).getByLabelText('Release date')).toHaveValue(
      '1983-03-07',
    )
    expect(h.within(form).getByLabelText('Type')).toHaveValue('single')
    expect(h.within(form).getByLabelText('Genre Electronic')).toBeChecked()
    expect(h.within(form).getByLabelText('Genre Leftfield')).toBeChecked()
    expect(h.within(form).getByText('Factory')).toBeInTheDocument()
    expect(h.within(form).getByText('FAC 73')).toBeInTheDocument()
    expect(h.within(form).getAllByText('Blue Monday').length).toBeGreaterThan(0)
    expect(h.within(form).getByLabelText('Disc')).toHaveValue('Factory 12-inch')
    expect(h.within(form).getByLabelText('Side')).toHaveValue('A')
    expect(
      h.within(form).getByRole('button', { name: 'Add record' }),
    ).toBeEnabled()
    expect(
      h.screen.queryByRole('complementary', { name: 'Blue Monday' }),
    ).not.toBeInTheDocument()
  })

  it('reviews an existing release update before applying selected field groups and provenance', async () => {
    window.history.pushState({}, '', '/releases?release=blue-monday')
    const fetchMock = h.vi.fn<Window['fetch']>().mockImplementation((input) => {
      const url = requestUrl(input)

      if (url.pathname === '/api/external-metadata/discogs/releases') {
        return Promise.resolve(
          h.jsonResponse({
            items: [
              {
                source: source('249504'),
                title: 'Blue Monday 12"',
                artists: ['New Order'],
                year: 1983,
                labels: ['Factory'],
                formats: ['Vinyl', '12"'],
                catalogNumber: 'FAC 73',
                barcodes: [],
              },
            ],
            limit: 25,
            total: 1,
          }),
        )
      }

      if (url.pathname === '/api/external-metadata/discogs/releases/249504') {
        return Promise.resolve(
          h.jsonResponse({
            ...releaseDetail(),
            title: 'Blue Monday 12"',
            draft: {
              ...releaseDetail().draft,
              title: 'Blue Monday 12"',
            },
          }),
        )
      }

      throw new Error(`Unexpected request: ${url.pathname}`)
    })
    h.vi.stubGlobal('fetch', fetchMock)
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(
      h.screen.getByRole('button', { name: 'Update via Discogs' }),
    )
    const form = h.screen.getByRole('form', { name: 'Edit release' })
    const lookup = h.within(form).getByRole('region', {
      name: 'Discogs release lookup',
    })

    await user.click(
      h.within(lookup).getByRole('button', { name: 'Search Discogs releases' }),
    )
    await user.click(
      await h.within(lookup).findByRole('button', {
        name: /review blue monday 12/i,
      }),
    )

    expect(h.within(form).getByLabelText('Title')).toHaveValue('Blue Monday')

    await user.click(h.within(lookup).getByLabelText('Apply Core'))
    expect(
      h.within(lookup).queryByLabelText('Apply External Source'),
    ).toBeNull()
    await user.click(
      h.within(lookup).getByRole('button', {
        name: 'Apply selected Discogs fields',
      }),
    )

    expect(
      h
        .within(lookup)
        .getByText(
          'Applied Discogs core to the form. Save record to persist changes.',
        ),
    ).toBeInTheDocument()
    expect(h.within(form).getByLabelText('Title')).toHaveValue(
      'Blue Monday 12"',
    )

    await user.click(
      h.within(form).getByRole('button', { name: 'Save record' }),
    )

    const updatedRelease = h
      .getInitialCatalogStateForTests()
      ?.releases.find((release) => release.id === 'blue-monday')
    expect(updatedRelease).toMatchObject({
      title: 'Blue Monday 12"',
      releaseDate: '1983-03-07',
      externalSources: [
        {
          providerName: 'discogs',
          resourceType: 'release',
          externalId: '249504',
          sourceUrl: 'https://www.discogs.com/release/249504',
        },
      ],
    })
    expect(updatedRelease?.externalSources?.[0].appliedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    )
  })

  it('shows track artist and compilation impact before applying a Discogs tracklist', async () => {
    window.history.pushState({}, '', '/releases')
    const fetchMock = h.vi.fn<Window['fetch']>().mockImplementation((input) => {
      const url = requestUrl(input)

      if (url.pathname === '/api/external-metadata/discogs/releases') {
        return Promise.resolve(
          h.jsonResponse({
            items: [
              {
                source: source('orb-1991'),
                title: "The Orb's Adventures Beyond The Ultraworld",
                artists: ['The Orb'],
                year: 1991,
                labels: ['Big Life'],
                formats: ['CD', 'Album'],
                catalogNumber: 'BLRCD 5',
                barcodes: ['042284796323'],
              },
            ],
            limit: 25,
            total: 1,
          }),
        )
      }

      if (url.pathname === '/api/external-metadata/discogs/releases/orb-1991') {
        return Promise.resolve(h.jsonResponse(compilationReleaseDetail()))
      }

      throw new Error(`Unexpected request: ${url.pathname}`)
    })
    h.vi.stubGlobal('fetch', fetchMock)
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add release' }))
    const form = h.screen.getByRole('form', { name: 'Add release' })

    await user.type(
      h.within(form).getByLabelText('Title'),
      "The Orb's Adventures",
    )
    await user.click(
      h.within(form).getByRole('button', { name: 'Search Discogs' }),
    )

    const lookup = h.within(form).getByRole('region', {
      name: 'Discogs release lookup',
    })
    await user.click(
      h.within(lookup).getByRole('button', { name: 'Search Discogs releases' }),
    )
    await user.click(
      await h.within(lookup).findByRole('button', {
        name: /review the orb's adventures/i,
      }),
    )

    expect(
      h.within(lookup).getByText(/Compilation detected/i),
    ).toBeInTheDocument()
    expect(h.within(lookup).queryByText(/Discogs heading row/i)).toBeNull()
    expect(
      h.within(lookup).getAllByText(/Orbit Compact Disc · Side A/i).length,
    ).toBeGreaterThan(0)
    expect(
      h.within(lookup).getByText('Little Fluffy Clouds'),
    ).toBeInTheDocument()
    expect(h.within(lookup).getByText('Earth (Gaia)')).toBeInTheDocument()
    expect(h.within(lookup).getByText('Perpetual Dawn')).toBeInTheDocument()
    expect(h.within(lookup).getAllByText('Main artist').length).toBeGreaterThan(
      0,
    )
    expect(h.within(lookup).getByText('Engineer')).toBeInTheDocument()
    expect(h.within(lookup).getByText('Guitar')).toBeInTheDocument()
    expect(h.within(lookup).getByText('Producer')).toBeInTheDocument()
    expect(h.within(lookup).getAllByText('Steve Hillage')).toHaveLength(1)
    expect(h.within(lookup).queryByText('New role accepted')).toBeNull()
    expect(h.within(lookup).queryByText('Matched local artist')).toBeNull()
    expect(h.within(lookup).queryByText('042284796323')).toBeNull()

    await user.click(
      h.within(lookup).getByRole('button', {
        name: 'Show 1 more Discogs track row',
      }),
    )
    expect(
      h.within(lookup).getByText('Into The Fourth Dimension'),
    ).toBeInTheDocument()

    await user.click(
      h.within(lookup).getByRole('button', {
        name: 'Apply selected Discogs fields',
      }),
    )

    expect(h.within(form).getByLabelText('Various Artists')).toBeChecked()
    expect(h.within(form).getByLabelText('Disc')).toHaveValue(
      'Orbit Compact Disc',
    )
    expect(h.within(form).getByLabelText('Side')).toHaveValue('A')
    expect(
      h.within(form).getByText('Track rows must include their own artists.'),
    ).toBeInTheDocument()
  })
})

function requestUrl(input: Parameters<Window['fetch']>[0]) {
  if (typeof input === 'string' || input instanceof URL) {
    return new URL(input, 'http://localhost')
  }

  return new URL(input.url, 'http://localhost')
}

function source(externalId: string) {
  return {
    providerName: 'discogs',
    resourceType: 'release',
    externalId,
    sourceUrl: `https://www.discogs.com/release/${externalId}`,
    attribution: 'Data provided by Discogs.',
  }
}

function releaseDetail() {
  return {
    source: source('249504'),
    title: 'Blue Monday',
    artists: ['New Order'],
    year: 1983,
    labels: ['Factory'],
    formats: ['Vinyl', '12"'],
    tracklist: [
      {
        title: 'Blue Monday',
        position: 'A',
        disc: 'Factory 12-inch',
        side: 'A',
        durationSeconds: 449,
        artists: ['New Order'],
      },
    ],
    identifiers: [{ type: 'Barcode', value: '5016839200371' }],
    barcodes: ['5016839200371'],
    catalogNumber: 'FAC 73',
    credits: [{ name: 'New Order', role: 'Written-By' }],
    draft: {
      title: 'Blue Monday',
      type: 'single',
      genres: ['Electronic', 'Leftfield'],
      year: 1983,
      releaseDate: '1983-03-07',
      artistCredits: [{ name: 'New Order', role: 'mainArtist' }],
      labels: [
        {
          name: 'Factory',
          catalogNumber: 'FAC 73',
          hasNoCatalogNumber: false,
        },
      ],
      tracklist: [
        {
          title: 'Blue Monday',
          position: 1,
          disc: 'Factory 12-inch',
          side: 'A',
          durationSeconds: 449,
          artistCredits: [
            { name: 'New Order', role: 'mainArtist' },
            { name: 'New Order', role: 'Written-By' },
          ],
        },
      ],
      externalSources: [
        {
          providerName: 'discogs',
          resourceType: 'release',
          externalId: '249504',
          sourceUrl: 'https://www.discogs.com/release/249504',
        },
      ],
    },
  }
}

function compilationReleaseDetail() {
  return {
    source: source('orb-1991'),
    title: "The Orb's Adventures Beyond The Ultraworld",
    artists: ['The Orb'],
    year: 1991,
    labels: ['Big Life'],
    formats: ['CD', 'Album'],
    tracklist: [],
    identifiers: [{ type: 'Barcode', value: '042284796323' }],
    barcodes: ['042284796323'],
    catalogNumber: 'BLRCD 5',
    credits: [],
    draft: {
      title: "The Orb's Adventures Beyond The Ultraworld",
      genres: ['Electronic'],
      year: 1991,
      artistCredits: [{ name: 'The Orb', role: 'mainArtist' }],
      labels: [
        {
          name: 'Big Life',
          catalogNumber: 'BLRCD 5',
          hasNoCatalogNumber: false,
        },
      ],
      tracklist: [
        {
          title: 'Little Fluffy Clouds',
          position: 1,
          disc: 'Orbit Compact Disc',
          side: 'A',
          durationSeconds: 269,
          artistCredits: [{ name: 'The Orb', role: 'mainArtist' }],
        },
        {
          title: 'Earth (Gaia)',
          position: 2,
          disc: 'Orbit Compact Disc',
          side: 'A',
          durationSeconds: 580,
          artistCredits: [
            { name: 'The Orb', role: 'mainArtist' },
            { name: 'Andy Falconer', role: 'engineer' },
          ],
        },
        {
          title: 'Perpetual Dawn',
          position: 3,
          disc: 'Orbit Compact Disc',
          side: 'B',
          durationSeconds: 568,
          artistCredits: [
            { name: 'The Orb', role: 'mainArtist' },
            { name: 'Steve Hillage', role: 'Guitar' },
            { name: 'Steve Hillage', role: 'Producer' },
          ],
        },
        {
          title: 'Back Side Of The Moon',
          position: 4,
          disc: 'Ultraworld Index',
          side: 'C',
          durationSeconds: 826,
          artistCredits: [{ name: 'Thomas Fehlmann', role: 'mainArtist' }],
        },
        {
          title: 'Into The Fourth Dimension',
          position: 5,
          disc: 'Ultraworld Index',
          side: 'D',
          durationSeconds: 572,
          artistCredits: [{ name: 'The Orb', role: 'mainArtist' }],
        },
      ],
      externalSources: [
        {
          providerName: 'discogs',
          resourceType: 'release',
          externalId: 'orb-1991',
          sourceUrl: 'https://www.discogs.com/release/orb-1991',
        },
      ],
    },
  }
}
