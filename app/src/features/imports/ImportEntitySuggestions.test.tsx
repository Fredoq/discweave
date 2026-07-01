import { describe, expect, it, vi } from 'vitest'
import * as h from '../../test/appTestHarness'
import { ImportArtistCreditsEditor } from './ImportArtistCreditsEditor'
import { DraftEditor } from './ImportDraftEditor'
import { ImportLabelsEditor } from './ImportLabelsEditor'
h.setupAppTestHooks()

describe('import entity suggestions', () => {
  it('searches existing artists while editing release import credits', async () => {
    const user = h.userEvent.setup()
    const onChange = vi.fn()
    mockSearch({
      artist: [
        {
          id: 'artist-run-dmc',
          title: 'Run-DMC',
          identityHint: 'Discogs #123',
        },
      ],
      label: [],
    })

    h.render(
      <ImportArtistCreditsEditor
        artists={[]}
        creditRoleOptions={[]}
        credits={[]}
        isVariousArtists={false}
        onChange={onChange}
      />,
    )

    await user.type(h.screen.getByLabelText('Release artist'), 'Run-DM')
    expect(
      await h.screen.findByRole('button', { name: 'Run-DMC' }),
    ).toBeVisible()
    expect(await h.screen.findByText('Discogs #123')).toBeVisible()

    await user.click(h.screen.getByRole('button', { name: 'Run-DMC' }))

    expect(onChange).toHaveBeenCalledWith([
      { artistId: 'artist-run-dmc', name: 'Run-DMC', role: '' },
    ])
  })

  it('searches existing labels while editing release import labels', async () => {
    const user = h.userEvent.setup()
    const onChange = vi.fn()
    mockSearch({
      artist: [],
      label: [{ id: 'label-pias', title: 'PIAS Benelux' }],
    })

    h.render(
      <ImportLabelsEditor labels={[]} notOnLabel={false} onChange={onChange} />,
    )

    await user.type(h.screen.getByLabelText('Label'), 'PIAS')
    expect(
      await h.screen.findByRole('button', { name: 'PIAS Benelux' }),
    ).toBeVisible()

    await user.click(h.screen.getByRole('button', { name: 'PIAS Benelux' }))

    expect(onChange).toHaveBeenCalledWith([
      {
        catalogNumber: null,
        hasNoCatalogNumber: false,
        labelId: 'label-pias',
        name: 'PIAS Benelux',
      },
    ])
  })

  it('seeds import label catalog number from a parsed draft catalog number', () => {
    const onChange = vi.fn()

    h.render(
      <DraftEditor
        actionError={null}
        artists={[]}
        creditRoleOptions={h.defaultCatalogDictionaries.creditRole}
        dictionaries={h.defaultCatalogDictionaries}
        draft={{
          id: 'draft-1',
          sourcePath: '/Music/[MORE 01, 1993-00-00] Robin S - Show Me Love',
          relativePath: '[MORE 01, 1993-00-00] Robin S - Show Me Love',
          status: 'needsReview',
          title: 'Show Me Love',
          type: 'unknown',
          catalogNumber: 'MORE 01',
          labelName: null,
          releaseDate: null,
          year: 1993,
          isVariousArtists: false,
          notOnLabel: false,
          artistNames: ['Robin S.'],
          artistCredits: [],
          selectedArtistIds: [],
          artistSuggestions: [],
          labels: [],
          genres: [],
          tags: [],
          externalSources: [],
          coverPath: null,
          issues: [],
          tracks: [],
        }}
        genreOptions={h.defaultCatalogDictionaries.genre}
        releaseTypeOptions={h.defaultCatalogDictionaries.releaseType}
        validationMessage=""
        onChange={onChange}
        onConfirm={vi.fn()}
        onSave={vi.fn()}
        onSkip={vi.fn()}
      />,
    )

    expect(h.screen.getByLabelText('Catalog number')).toHaveValue('MORE 01')
  })

  it('clears stale suggestions while a new import query is debounced', async () => {
    const user = h.userEvent.setup()
    const onChange = vi.fn()
    mockSearchByQuery({
      Run: [{ id: 'artist-run-dmc', title: 'Run-DMC' }],
      Pia: [{ id: 'artist-pi', title: 'Pia Fraus' }],
    })

    h.render(
      <ImportArtistCreditsEditor
        artists={[]}
        creditRoleOptions={[]}
        credits={[]}
        isVariousArtists={false}
        onChange={onChange}
      />,
    )

    await user.type(h.screen.getByLabelText('Release artist'), 'Run')
    expect(
      await h.screen.findByRole('button', { name: 'Run-DMC' }),
    ).toBeVisible()

    await user.clear(h.screen.getByLabelText('Release artist'))
    await user.type(h.screen.getByLabelText('Release artist'), 'Pia')

    expect(
      h.screen.queryByRole('button', { name: 'Run-DMC' }),
    ).not.toBeInTheDocument()
  })
})

function mockSearch(results: {
  artist: Array<{ id: string; title: string; identityHint?: string }>
  label: Array<{ id: string; title: string; identityHint?: string }>
}) {
  vi.stubGlobal(
    'fetch',
    vi.fn<Window['fetch']>((input) => {
      const requestUrl =
        typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : ''
      const url = new URL(requestUrl, window.location.origin)
      const entityType = url.searchParams.get('entityType') as
        | 'artist'
        | 'label'
      return Promise.resolve(
        h.jsonResponse({
          items: results[entityType].map((item) => ({
            facets: {
              collectorSignals: [],
              media: [],
              roles: [],
              statuses: [],
              tags: [],
            },
            id: item.id,
            matchedFields: ['name'],
            rank: 1,
            snippets: [item.title],
            title: item.title,
            type: entityType,
            identityHint: item.identityHint,
          })),
          limit: 5,
          offset: 0,
          total: results[entityType].length,
        }),
      )
    }),
  )
}

function mockSearchByQuery(
  results: Record<
    string,
    Array<{ id: string; title: string; identityHint?: string }>
  >,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn<Window['fetch']>((input) => {
      const requestUrl =
        typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : ''
      const url = new URL(requestUrl, window.location.origin)
      const query = url.searchParams.get('query') ?? ''
      const items = results[query] ?? []
      return Promise.resolve(
        h.jsonResponse({
          items: items.map((item) => ({
            facets: {
              collectorSignals: [],
              media: [],
              roles: [],
              statuses: [],
              tags: [],
            },
            id: item.id,
            matchedFields: ['name'],
            rank: 1,
            snippets: [item.title],
            title: item.title,
            type: 'artist',
            identityHint: item.identityHint,
          })),
          limit: 5,
          offset: 0,
          total: items.length,
        }),
      )
    }),
  )
}
