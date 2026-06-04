import { describe, expect, it } from 'vitest'
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
    expect(h.within(lookup).getByText('Arthur Baker III')).toBeInTheDocument()
    expect(
      h
        .within(lookup)
        .getByRole('link', { name: 'Open Discogs artist source' }),
    ).toHaveAttribute('href', 'https://www.discogs.com/artist/5876')

    await user.click(
      h.within(lookup).getByRole('button', {
        name: 'Apply selected Discogs fields',
      }),
    )

    expect(h.within(form).getByLabelText('Name')).toHaveValue('Arthur Baker')
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

  it('reviews an existing artist update before applying selected groups', async () => {
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
    await user.click(h.within(lookup).getByLabelText('Apply Core'))
    await user.click(h.within(lookup).getByLabelText('Apply External Source'))
    await user.click(
      h.within(lookup).getByRole('button', {
        name: 'Apply selected Discogs fields',
      }),
    )
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
