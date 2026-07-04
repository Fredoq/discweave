import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App Discogs track autocomplete', () => {
  it('searches track candidates and prefills a new track only after review apply', async () => {
    window.history.pushState({}, '', '/tracks')
    const fetchMock = h.vi.fn<Window['fetch']>().mockImplementation((input) => {
      const url = requestUrl(input)

      if (url.pathname === '/api/external-metadata/discogs/tracks') {
        return Promise.resolve(
          h.jsonResponse({
            items: [trackCandidate()],
            limit: 25,
            total: 1,
          }),
        )
      }

      if (
        url.pathname ===
        `/api/external-metadata/discogs/tracks/${encodeURIComponent(trackId)}`
      ) {
        return Promise.resolve(h.jsonResponse(trackDetail()))
      }

      throw new Error(`Unexpected request: ${url.pathname}`)
    })
    h.vi.stubGlobal('fetch', fetchMock)
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add track' }))
    const form = h.screen.getByRole('form', { name: 'Add track' })

    await user.type(h.within(form).getByLabelText('Title'), 'Working track')
    await user.click(
      h.within(form).getByRole('button', { name: 'Search Discogs' }),
    )

    const lookup = h.within(form).getByRole('region', {
      name: 'Discogs track lookup',
    })
    expect(h.within(lookup).queryByLabelText('Discogs barcode')).toBeNull()
    await user.type(
      h.within(lookup).getByLabelText('Discogs release track count'),
      '1',
    )
    await user.click(
      h.within(lookup).getByRole('button', { name: 'Search Discogs tracks' }),
    )
    expect(
      requestUrl(fetchMock.mock.calls[0]?.[0]).searchParams.has('barcode'),
    ).toBe(false)
    expect(
      requestUrl(fetchMock.mock.calls[0]?.[0]).searchParams.get('trackCount'),
    ).toBe('1')
    await user.click(
      await h.within(lookup).findByRole('button', {
        name: /review blue monday/i,
      }),
    )

    expect(h.within(form).getByLabelText('Title')).toHaveValue('Working track')
    expect(
      await h.within(lookup).findByRole('heading', {
        name: 'Review Discogs track',
      }),
    ).toBeInTheDocument()
    expect(h.within(lookup).getAllByText('New Order').length).toBeGreaterThan(0)
    expect(
      h.within(lookup).getAllByText('Data provided by Discogs.').length,
    ).toBeGreaterThan(0)
    expect(
      h.within(lookup).getByRole('link', { name: 'Open Discogs track source' }),
    ).toHaveAttribute('href', 'https://www.discogs.com/release/249504')
    expect(h.within(lookup).getByText('Producer')).toBeInTheDocument()
    expect(
      h.within(lookup).queryByLabelText('Apply External Source'),
    ).toBeNull()

    await user.click(
      h.within(lookup).getByRole('button', {
        name: 'Apply selected Discogs fields',
      }),
    )

    expect(h.within(form).getByLabelText('Title')).toHaveValue('Blue Monday')
    expect(h.within(form).getByLabelText('Track duration minutes')).toHaveValue(
      7,
    )
    expect(h.within(form).getByLabelText('Track duration seconds')).toHaveValue(
      29,
    )
    expect(
      h
        .within(lookup)
        .getByText(/Applied Discogs core and credits to the form/i),
    ).toBeInTheDocument()
    expect(
      h.within(lookup).queryByRole('heading', {
        name: 'Review Discogs track',
      }),
    ).toBeNull()

    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    const createdTrack = h
      .getInitialCatalogStateForTests()
      ?.tracks.filter((track) => track.title === 'Blue Monday')
      .slice(-1)[0]
    expect(createdTrack?.externalSources?.[0]).toMatchObject({
      providerName: 'discogs',
      resourceType: 'track',
      externalId: trackId,
      sourceUrl: 'https://www.discogs.com/release/249504',
    })
    expect(createdTrack?.externalSources?.[0].appliedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    )
    expect(createdTrack?.credits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          artist: 'New Order',
          role: 'Main artist',
          roles: ['Main artist', 'Producer'],
        }),
      ]),
    )
  })

  it('sorts Discogs track candidates by release year and pages through results', async () => {
    window.history.pushState({}, '', '/tracks')
    const fetchMock = h.vi.fn<Window['fetch']>().mockImplementation((input) => {
      const url = requestUrl(input)

      if (url.pathname === '/api/external-metadata/discogs/tracks') {
        const page = url.searchParams.get('page') ?? '1'
        return Promise.resolve(
          h.jsonResponse({
            items: [
              {
                ...trackCandidate(),
                source: source(`page-${page}`),
                title:
                  page === '1' ? 'Show Me Love (1990)' : 'Show Me Love (1991)',
                release: {
                  ...trackCandidate().release,
                  title: page === '1' ? 'Early Release' : 'Later Release',
                  year: page === '1' ? 1990 : 1991,
                },
              },
            ],
            limit: 1,
            page: Number(page),
            total: 2,
          }),
        )
      }

      throw new Error(`Unexpected request: ${url.pathname}`)
    })
    h.vi.stubGlobal('fetch', fetchMock)
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add track' }))
    const form = h.screen.getByRole('form', { name: 'Add track' })
    await user.type(h.within(form).getByLabelText('Title'), 'Show Me Love')
    await user.click(
      h.within(form).getByRole('button', { name: 'Search Discogs' }),
    )

    const lookup = h.within(form).getByRole('region', {
      name: 'Discogs track lookup',
    })
    await user.selectOptions(
      h.within(lookup).getByLabelText('Discogs track result sort'),
      'releaseYearAsc',
    )
    await user.click(
      h.within(lookup).getByRole('button', { name: 'Search Discogs tracks' }),
    )

    expect(
      await h.within(lookup).findByText(/Early Release/),
    ).toBeInTheDocument()
    const firstSearchUrl = requestUrl(fetchMock.mock.calls[0]?.[0])
    expect(firstSearchUrl.searchParams.get('sort')).toBe('releaseYearAsc')
    expect(firstSearchUrl.searchParams.get('page')).toBe('1')

    await user.click(
      h.within(lookup).getByRole('button', { name: 'Next page' }),
    )

    expect(
      await h.within(lookup).findByText(/Later Release/),
    ).toBeInTheDocument()
    const secondSearchUrl = requestUrl(fetchMock.mock.calls[1]?.[0])
    expect(secondSearchUrl.searchParams.get('sort')).toBe('releaseYearAsc')
    expect(secondSearchUrl.searchParams.get('page')).toBe('2')
    expect(h.within(lookup).getByText('Page 2 of 2')).toBeInTheDocument()
  })

  it('reviews an existing track update before applying selected groups', async () => {
    window.history.pushState({}, '', '/tracks?track=blue-monday')
    const fetchMock = h.vi.fn<Window['fetch']>().mockImplementation((input) => {
      const url = requestUrl(input)

      if (url.pathname === '/api/external-metadata/discogs/tracks') {
        return Promise.resolve(
          h.jsonResponse({
            items: [
              {
                ...trackCandidate(),
                title: 'Blue Monday (Factory Mix)',
              },
            ],
            limit: 25,
            total: 1,
          }),
        )
      }

      if (
        url.pathname ===
        `/api/external-metadata/discogs/tracks/${encodeURIComponent(trackId)}`
      ) {
        return Promise.resolve(
          h.jsonResponse({
            ...trackDetail(),
            title: 'Blue Monday (Factory Mix)',
            draft: {
              ...trackDetail().draft,
              title: 'Blue Monday (Factory Mix)',
              durationSeconds: null,
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
    const form = h.screen.getByRole('form', { name: 'Edit track' })
    const lookup = h.within(form).getByRole('region', {
      name: 'Discogs track lookup',
    })

    await user.click(
      h.within(lookup).getByRole('button', { name: 'Search Discogs tracks' }),
    )
    await user.click(
      await h.within(lookup).findByRole('button', {
        name: /review blue monday/i,
      }),
    )

    expect(h.within(form).getByLabelText('Title')).toHaveValue('Blue Monday')

    await user.click(h.within(lookup).getByLabelText('Apply Core'))
    await user.click(h.within(lookup).getByLabelText('Apply Credits'))
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
        .getByText(/Applied Discogs core and credits to the form/i),
    ).toBeInTheDocument()
    expect(h.within(form).getByLabelText('Track duration minutes')).toHaveValue(
      7,
    )
    expect(h.within(form).getByLabelText('Track duration seconds')).toHaveValue(
      29,
    )
    await user.click(
      h.within(form).getByRole('button', { name: 'Save record' }),
    )

    const updatedTrack = h
      .getInitialCatalogStateForTests()
      ?.tracks.find((track) => track.id === 'blue-monday')
    expect(updatedTrack).toMatchObject({
      title: 'Blue Monday (Factory Mix)',
      duration: '7:29',
      credits: [
        {
          artist: 'New Order',
          role: 'Main artist',
          roles: ['Main artist', 'Producer'],
        },
      ],
      externalSources: [
        {
          providerName: 'discogs',
          resourceType: 'track',
          externalId: trackId,
          sourceUrl: 'https://www.discogs.com/release/249504',
        },
      ],
    })
  })

  it('focuses the Discogs track lookup when updating from track detail', async () => {
    window.history.pushState({}, '', '/tracks?track=blue-monday')
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(
      h.screen.getByRole('button', { name: 'Update via Discogs' }),
    )

    const form = h.screen.getByRole('form', { name: 'Edit track' })
    const lookup = h.within(form).getByRole('region', {
      name: 'Discogs track lookup',
    })

    await h.waitFor(() => {
      expect(
        h.within(lookup).getByLabelText('Discogs track title'),
      ).toHaveFocus()
    })
  })
})

const trackId = '249504:A:Blue-Monday'

function requestUrl(input: Parameters<Window['fetch']>[0]) {
  if (typeof input === 'string' || input instanceof URL) {
    return new URL(input, 'http://localhost')
  }

  return new URL(input.url, 'http://localhost')
}

function source(externalId: string, resourceType = 'track') {
  return {
    providerName: 'discogs',
    resourceType,
    externalId,
    sourceUrl: 'https://www.discogs.com/release/249504',
    attribution: 'Data provided by Discogs.',
  }
}

function trackCandidate() {
  return {
    source: source(trackId),
    title: 'Blue Monday',
    position: 'A',
    durationSeconds: 449,
    artists: ['New Order'],
    release: {
      source: source('249504', 'release'),
      title: 'Blue Monday',
      year: 1983,
      artists: ['New Order'],
    },
  }
}

function trackDetail() {
  return {
    ...trackCandidate(),
    credits: [
      {
        name: 'New Order',
        role: 'Producer',
      },
    ],
    draft: {
      title: 'Blue Monday',
      durationSeconds: 449,
      artistCredits: [
        {
          name: 'New Order',
          role: 'Main artist',
        },
        {
          name: 'New Order',
          role: 'Producer',
        },
      ],
      externalSources: [
        {
          providerName: 'discogs',
          resourceType: 'track',
          externalId: trackId,
          sourceUrl: 'https://www.discogs.com/release/249504',
        },
      ],
    },
  }
}
