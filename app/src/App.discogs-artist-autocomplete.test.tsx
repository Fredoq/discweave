import { describe, expect, it } from 'vitest'
import { ArtistEntryForm } from './features/artists/ArtistsWorkspace'
import type { ArtistRecord } from './features/artists/artistsData'
import type { DiscogsArtistApplyRequest } from './features/catalog/api/externalMetadataClient'
import * as h from './test/appTestHarness'

h.setupAppTestHooks()

describe('App Discogs artist autocomplete', () => {
  it('searches artist candidates and prefills a new artist only after review apply', async () => {
    window.history.pushState({}, '', '/artists')
    const fetchMock = h.vi.fn<Window['fetch']>().mockImplementation((input) => {
      const url = requestUrl(input)

      if (url.pathname === '/api/external-metadata/discogs/artists') {
        return Promise.resolve(
          h.jsonResponse({
            items: [
              {
                source: source('5876'),
                name: 'Arthur Baker',
                profile: 'Producer and remixer.',
                nameVariations: ['A. Baker'],
              },
            ],
            limit: 25,
            total: 1,
          }),
        )
      }

      if (url.pathname === '/api/external-metadata/discogs/artists/5876') {
        return Promise.resolve(h.jsonResponse(artistDetail()))
      }

      throw new Error(`Unexpected request: ${url.pathname}`)
    })
    h.vi.stubGlobal('fetch', fetchMock)
    const user = h.userEvent.setup()
    h.render(<h.App />)

    await user.click(h.screen.getByRole('button', { name: 'Add artist' }))
    const form = h.screen.getByRole('form', { name: 'Add artist' })

    await user.type(h.within(form).getByLabelText('Name'), 'Local Artist')
    await user.click(
      h.within(form).getByRole('button', { name: 'Search Discogs' }),
    )

    const lookup = h.within(form).getByRole('region', {
      name: 'Discogs artist lookup',
    })
    await user.click(
      h.within(lookup).getByRole('button', { name: 'Search Discogs artists' }),
    )
    await user.click(
      await h.within(lookup).findByRole('button', {
        name: /review arthur baker/i,
      }),
    )

    expect(h.within(form).getByLabelText('Name')).toHaveValue('Local Artist')
    expect(
      await h.within(lookup).findByRole('heading', {
        name: 'Review Discogs artist',
      }),
    ).toBeInTheDocument()
    const candidateCard = h.within(lookup).getByRole('article', {
      name: /arthur baker/i,
    })
    expect(
      h.within(candidateCard).getByRole('heading', {
        name: 'Review Discogs artist',
      }),
    ).toBeInTheDocument()
    expect(
      h.within(lookup).queryByLabelText('Apply External Source'),
    ).not.toBeInTheDocument()
    expect(
      h.within(candidateCard).getByText('Arthur Baker III'),
    ).toBeInTheDocument()
    expect(h.within(candidateCard).getByText('Real name')).toBeInTheDocument()
    expect(
      h
        .within(lookup)
        .getByRole('link', { name: 'Open Discogs artist source' }),
    ).toHaveAttribute('href', 'https://www.discogs.com/artist/5876')

    await user.click(
      h.within(lookup).getByRole('button', {
        name: 'Apply Discogs data',
      }),
    )

    expect(h.within(form).getByLabelText('Name')).toHaveValue('Arthur Baker')
    expect(h.within(form).getByLabelText('Type')).toHaveValue('Band')
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    const createdArtist = h
      .getInitialCatalogStateForTests()
      ?.artists.find((artist) => artist.name === 'Arthur Baker')
    expect(createdArtist?.externalSources?.[0]).toMatchObject({
      providerName: 'discogs',
      resourceType: 'artist',
      externalId: '5876',
      sourceUrl: 'https://www.discogs.com/artist/5876',
    })
    expect(createdArtist?.externalSources?.[0].appliedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    )
  })

  it('reviews an existing artist update before applying Discogs data', async () => {
    window.history.pushState({}, '', '/artists?artist=new-order')
    const fetchMock = h.vi.fn<Window['fetch']>().mockImplementation((input) => {
      const url = requestUrl(input)

      if (url.pathname === '/api/external-metadata/discogs/artists') {
        return Promise.resolve(
          h.jsonResponse({
            items: [
              {
                source: source('3909'),
                name: 'New Order',
                profile: 'English rock band.',
                nameVariations: ['N.O.'],
              },
            ],
            limit: 25,
            total: 1,
          }),
        )
      }

      if (url.pathname === '/api/external-metadata/discogs/artists/3909') {
        return Promise.resolve(
          h.jsonResponse({
            ...artistDetail('3909', 'New Order'),
            profile: 'English rock band.',
            aliases: ['NO'],
            members: ['Bernard Sumner'],
            nameVariations: ['N.O.'],
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
    const form = h.screen.getByRole('form', { name: 'Edit artist' })
    const lookup = h.within(form).getByRole('region', {
      name: 'Discogs artist lookup',
    })

    await user.click(
      h.within(lookup).getByRole('button', { name: 'Search Discogs artists' }),
    )
    await user.click(
      await h.within(lookup).findByRole('button', {
        name: /review new order/i,
      }),
    )
    const candidateCard = h.within(lookup).getByRole('article', {
      name: /new order/i,
    })
    expect(
      h.within(candidateCard).getByRole('heading', {
        name: 'Review Discogs artist',
      }),
    ).toBeInTheDocument()
    expect(
      h.within(lookup).queryByLabelText('Apply External Source'),
    ).not.toBeInTheDocument()
    await user.click(
      h.within(lookup).getByRole('button', {
        name: 'Apply Discogs data',
      }),
    )
    expect(h.within(form).getByLabelText('Type')).toHaveValue('Band')
    await user.click(
      h.within(form).getByRole('button', { name: 'Save record' }),
    )

    const updatedArtist = h
      .getInitialCatalogStateForTests()
      ?.artists.find((artist) => artist.id === 'new-order')
    expect(updatedArtist?.externalSources?.[0]).toMatchObject({
      providerName: 'discogs',
      resourceType: 'artist',
      externalId: '3909',
    })
  })

  it('submits Discogs artist detail after applying Discogs data', async () => {
    const fetchMock = h.vi.fn<Window['fetch']>().mockImplementation((input) => {
      const url = requestUrl(input)

      if (url.pathname === '/api/external-metadata/discogs/artists') {
        return Promise.resolve(
          h.jsonResponse({
            items: [
              {
                source: source('5876'),
                name: 'Arthur Baker',
                profile: 'Producer and remixer.',
                nameVariations: ['A. Baker'],
              },
            ],
            limit: 25,
            total: 1,
          }),
        )
      }

      if (url.pathname === '/api/external-metadata/discogs/artists/5876') {
        return Promise.resolve(h.jsonResponse(artistDetail()))
      }

      throw new Error(`Unexpected request: ${url.pathname}`)
    })
    h.vi.stubGlobal('fetch', fetchMock)
    const onSubmit =
      h.vi.fn<
        (
          artist: ArtistRecord,
          discogsArtist?: DiscogsArtistApplyRequest | null,
        ) => void
      >()
    const user = h.userEvent.setup()
    h.render(
      <ArtistEntryForm
        artists={h.artistRecords}
        initialShowDiscogsLookup
        onCancel={() => {}}
        onSubmit={onSubmit}
      />,
    )
    const form = h.screen.getByRole('form', { name: 'Add artist' })
    const lookup = h.within(form).getByRole('region', {
      name: 'Discogs artist lookup',
    })

    await user.type(h.within(form).getByLabelText('Name'), 'Local Artist')
    await user.type(
      h.within(lookup).getByLabelText('Discogs artist query'),
      'Arthur Baker',
    )
    await user.click(
      h.within(lookup).getByRole('button', { name: 'Search Discogs artists' }),
    )
    await user.click(
      await h.within(lookup).findByRole('button', {
        name: /review arthur baker/i,
      }),
    )
    expect(
      h.within(lookup).getByRole('button', { name: 'Apply Discogs data' }),
    ).toBeInTheDocument()
    expect(
      h.within(lookup).queryByLabelText('Apply External Source'),
    ).not.toBeInTheDocument()
    await user.click(
      h.within(lookup).getByRole('button', {
        name: 'Apply Discogs data',
      }),
    )
    await user.click(h.within(form).getByRole('button', { name: 'Add record' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const [artist, discogsArtist] = onSubmit.mock.calls[0]
    expect(artist.name).toBe('Arthur Baker')
    expect(artist.type).toBe('Band')
    expect(artist.externalSources?.[0]).toMatchObject({
      providerName: 'discogs',
      resourceType: 'artist',
      externalId: '5876',
      sourceUrl: 'https://www.discogs.com/artist/5876',
    })
    expect(discogsArtist).toMatchObject({
      source: {
        externalId: '5876',
        providerName: 'discogs',
        resourceType: 'artist',
      },
      name: 'Arthur Baker',
      realName: 'Arthur Baker III',
      members: ['Rockers Revenge'],
    })
  })

  it('clears Discogs artist detail when type is changed manually after apply', async () => {
    const fetchMock = h.vi.fn<Window['fetch']>().mockImplementation((input) => {
      const url = requestUrl(input)

      if (url.pathname === '/api/external-metadata/discogs/artists') {
        return Promise.resolve(
          h.jsonResponse({
            items: [
              {
                source: source('3909'),
                name: 'New Order',
                profile: 'English rock band.',
                nameVariations: ['N.O.'],
              },
            ],
            limit: 25,
            total: 1,
          }),
        )
      }

      if (url.pathname === '/api/external-metadata/discogs/artists/3909') {
        return Promise.resolve(
          h.jsonResponse({
            ...artistDetail('3909', 'New Order'),
            members: ['Bernard Sumner'],
          }),
        )
      }

      throw new Error(`Unexpected request: ${url.pathname}`)
    })
    h.vi.stubGlobal('fetch', fetchMock)
    const onSubmit =
      h.vi.fn<
        (
          artist: ArtistRecord,
          discogsArtist?: DiscogsArtistApplyRequest | null,
        ) => void
      >()
    const user = h.userEvent.setup()
    h.render(
      <ArtistEntryForm
        artists={h.artistRecords}
        initialArtist={{
          ...h.artistRecords[2],
          externalSources: [
            {
              providerName: 'musicbrainz',
              resourceType: 'artist',
              externalId: '8538e728-ca0b-4321-b7e5-cff6565dd4c0',
              sourceUrl:
                'https://musicbrainz.org/artist/8538e728-ca0b-4321-b7e5-cff6565dd4c0',
              appliedAt: '2026-05-31T12:00:00.000Z',
            },
          ],
        }}
        initialShowDiscogsLookup
        onCancel={() => {}}
        onSubmit={onSubmit}
      />,
    )
    const form = h.screen.getByRole('form', { name: 'Edit artist' })
    const lookup = h.within(form).getByRole('region', {
      name: 'Discogs artist lookup',
    })

    await user.click(
      h.within(lookup).getByRole('button', { name: 'Search Discogs artists' }),
    )
    await user.click(
      await h.within(lookup).findByRole('button', {
        name: /review new order/i,
      }),
    )
    await user.click(
      h.within(lookup).getByRole('button', {
        name: 'Apply Discogs data',
      }),
    )
    expect(h.within(form).getByLabelText('Type')).toHaveValue('Band')

    await user.selectOptions(h.within(form).getByLabelText('Type'), 'Person')
    await user.click(
      h.within(form).getByRole('button', { name: 'Save record' }),
    )

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const [artist, discogsArtist] = onSubmit.mock.calls[0]
    expect(artist.type).toBe('Person')
    expect(artist.externalSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerName: 'musicbrainz',
          externalId: '8538e728-ca0b-4321-b7e5-cff6565dd4c0',
        }),
        expect.objectContaining({
          providerName: 'discogs',
          externalId: '3909',
        }),
      ]),
    )
    expect(discogsArtist).toBeNull()
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
    resourceType: 'artist',
    externalId,
    sourceUrl: `https://www.discogs.com/artist/${externalId}`,
    attribution: 'Data provided by Discogs.',
  }
}

function artistDetail(externalId = '5876', name = 'Arthur Baker') {
  return {
    source: source(externalId),
    name,
    realName: 'Arthur Baker III',
    profile: 'Producer and remixer.',
    aliases: ['Arthur Baker III'],
    members: ['Rockers Revenge'],
    nameVariations: ['A. Baker'],
    draft: {
      name,
      externalSources: [
        {
          providerName: 'discogs',
          resourceType: 'artist',
          externalId,
          sourceUrl: `https://www.discogs.com/artist/${externalId}`,
        },
      ],
    },
  }
}
