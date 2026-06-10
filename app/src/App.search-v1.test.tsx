import { describe, expect, it } from 'vitest'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App search v1 UI', () => {
  it('shows role context and large-result guidance for server search results', async () => {
    h.clearCatalogForTests()
    h.mockFetch(
      searchResponseWithProducerTrack({ total: 240 }),
      graphResponse(),
    )

    h.render(<h.App />)

    const resultRow = await h.screen.findByRole('row', {
      name: /Archive Producer Cut/i,
    })

    expect(h.within(resultRow).getByText('Producer')).toBeInTheDocument()
    expect(h.within(resultRow).getByText('Owned')).toBeInTheDocument()
    expect(h.screen.queryByText('Matched on')).not.toBeInTheDocument()
    expect(
      h.screen.getByText('Showing 1-1 of 240 matches.'),
    ).toBeInTheDocument()
    expect(
      h.within(resultRow).getByRole('link', {
        name: 'Open Archive Producer Cut',
      }),
    ).toHaveAttribute('href', '/tracks?track=track-producer')
  })

  it('derives label filter options from server label results and sends combined filters', async () => {
    h.clearCatalogForTests()
    const fetchMock = h.mockFetch(
      ...Array.from({ length: 20 }).flatMap(() => [
        searchResponseWithProducerTrack({ includeLabelResult: true }),
        graphResponse(),
      ]),
    )
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await h.screen.findByRole('row', { name: /Factory Records/i })

    await user.selectOptions(h.screen.getByLabelText('Label'), 'label-1')
    await user.selectOptions(h.screen.getByLabelText('Media type'), 'vinyl')
    await user.selectOptions(
      h.screen.getByLabelText('Ownership status'),
      'owned',
    )
    await user.selectOptions(
      h.screen.getByLabelText('Credit or relation role'),
      'producer',
    )
    expect(
      h
        .within(h.screen.getByLabelText('Credit or relation role'))
        .getByRole('option', { name: 'Producer' }),
    ).toHaveValue('producer')
    await user.selectOptions(h.screen.getByLabelText('Tag'), 'warehouse')

    await h.waitFor(() => {
      expect(
        h.searchRequestUrls(fetchMock).some((url) => {
          const params = url.searchParams

          return (
            params.get('labelId') === 'label-1' &&
            params.get('media') === 'vinyl' &&
            params.get('status') === 'owned' &&
            params.get('role') === 'producer' &&
            params.get('tag') === 'warehouse'
          )
        }),
      ).toBe(true)
    })
  })

  it('opens relation graph links into the editable relations workspace', async () => {
    h.clearCatalogForTests()
    const fetchMock = h.vi.fn<Window['fetch']>(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      await Promise.resolve()

      if (url.startsWith('/api/search?')) {
        const params = new URL(url, window.location.origin).searchParams

        return params.get('savedView') === 'credits'
          ? h.emptySearchResponse()
          : searchResponseWithProducerTrack()
      }
      if (url === '/api/catalog-graph/track/track-producer') {
        return graphResponseWithRelation()
      }
      if (url.startsWith('/api/tracks?')) {
        return h.jsonResponse({
          items: [
            {
              id: 'track-producer',
              title: 'Archive Producer Cut',
              durationSeconds: null,
              genres: [],
              tags: [],
            },
            {
              id: 'track-private-dub',
              title: 'Private Dub',
              durationSeconds: null,
              genres: [],
              tags: [],
            },
          ],
          limit: 100,
          offset: 0,
          total: 2,
        })
      }
      if (url.startsWith('/api/track-relations?')) {
        return h.jsonResponse({
          items: [
            {
              id: 'private-relation',
              sourceTrackId: 'track-producer',
              targetTrackId: 'track-private-dub',
              type: 'remixOf',
              sourceTrackTitle: 'Archive Producer Cut',
              targetTrackTitle: 'Private Dub',
            },
          ],
          limit: 100,
          offset: 0,
          total: 1,
        })
      }
      if (url.startsWith('/api/settings/dictionaries?')) {
        return h.defaultDictionaryListResponse()
      }
      if (url.startsWith('/api/rating-criteria?')) {
        return h.defaultRatingCriteriaListResponse()
      }

      return h.emptyCatalogListResponse()
    })
    h.vi.stubGlobal('fetch', fetchMock)
    const user = h.userEvent.setup()

    h.render(<h.App />)

    await user.click(
      await h.screen.findByRole('link', {
        name: 'Archive Producer Cut to Private Dub',
      }),
    )

    await h.waitFor(() => {
      expect(window.location.pathname).toBe('/relations')
    })
    expect(
      fetchMock.mock.calls.some(
        ([input]) =>
          typeof input === 'string' &&
          input.startsWith('/api/track-relations?'),
      ),
    ).toBe(true)
    expect(
      fetchMock.mock.calls.some(
        ([input]) =>
          typeof input === 'string' &&
          input === '/api/track-relations/private-relation',
      ),
    ).toBe(false)

    expect(
      await h.screen.findByRole('heading', {
        name: 'Archive Producer Cut to Private Dub',
      }),
    ).toBeInTheDocument()
    expect(
      h.screen.getByRole('button', { name: 'Edit record' }),
    ).toBeInTheDocument()
  })
})

function searchResponseWithProducerTrack({
  includeLabelResult = false,
  total,
}: {
  includeLabelResult?: boolean
  total?: number
} = {}) {
  const items = [
    ...(includeLabelResult
      ? [
          {
            id: 'label-1',
            type: 'label',
            title: 'Factory Records',
            subtitle: 'Label',
            summary: 'Manchester label with producer-heavy catalog entries.',
            matchedFields: ['name'],
            snippets: ['Factory Records · Archive Producer Cut'],
            facets: {
              roles: [],
              media: ['vinyl'],
              statuses: ['owned'],
              tags: ['warehouse'],
              labelId: 'label-1',
              collectorSignals: [],
            },
            rank: 1,
          },
        ]
      : []),
    {
      id: 'track-producer',
      type: 'track',
      title: 'Archive Producer Cut',
      subtitle: 'Track',
      summary: 'Producer credit on a vinyl catalog track.',
      matchedFields: ['title', 'credits'],
      snippets: ['Archive Producer Cut · producer credit'],
      facets: {
        roles: ['producer'],
        media: ['vinyl'],
        statuses: ['Owned'],
        tags: ['warehouse'],
        labelId: 'label-1',
        collectorSignals: ['physicalWithoutDigital'],
      },
      rank: includeLabelResult ? 2 : 1,
    },
  ]

  return h.jsonResponse({
    items,
    limit: 100,
    offset: 0,
    total: total ?? items.length,
  })
}

function graphResponse() {
  return h.jsonResponse({
    entity: {
      id: 'track-producer',
      type: 'track',
      title: 'Archive Producer Cut',
      subtitle: 'Track',
      summary: 'Producer credit on a vinyl catalog track.',
    },
    sections: {
      artists: [],
      releases: [],
      tracks: [],
      ownedCopies: [],
      labels: [],
      playlists: [],
      credits: [],
      relations: [],
      media: [],
    },
    collectorSignals: ['Physical media without digital copy'],
  })
}

function graphResponseWithRelation() {
  return h.jsonResponse({
    entity: {
      id: 'track-producer',
      type: 'track',
      title: 'Archive Producer Cut',
      subtitle: 'Track',
      summary: 'Producer credit on a vinyl catalog track.',
    },
    sections: {
      artists: [],
      releases: [],
      tracks: [],
      ownedCopies: [],
      labels: [],
      playlists: [],
      credits: [],
      relations: [
        {
          id: 'private-relation',
          type: 'relation',
          title: 'Archive Producer Cut to Private Dub',
          subtitle: 'remixOf',
          relation: 'track relation',
        },
      ],
      media: [],
    },
    collectorSignals: ['Physical media without digital copy'],
  })
}
