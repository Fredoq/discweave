import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import App from '../App'
import {
  clearAuthSessionForTests,
  seedAuthSessionForTests,
} from '../features/auth/authApi'
import {
  clearCatalogForTests,
  defaultCatalogDictionaries,
  defaultRatingCriteria,
  getInitialCatalogStateForTests,
  seedCatalogForTests,
} from '../features/catalog/catalogApi'
import { buildCatalogEntries } from '../features/catalog/catalogGraph'
import { artistRecords } from '../features/artists/artistsData'
import { ownedItemRecords } from '../features/ownedItems/ownedItemsData'
import { playlistRecords } from '../features/playlists/playlistsData'
import { releaseRecords } from '../features/releases/releasesData'
import { relationRecords } from '../features/relations/relationsData'
import { trackRecords } from '../features/tracks/tracksData'

export {
  act,
  App,
  artistRecords,
  buildCatalogEntries,
  clearAuthSessionForTests,
  clearCatalogForTests,
  defaultCatalogDictionaries,
  defaultRatingCriteria,
  getInitialCatalogStateForTests,
  ownedItemRecords,
  playlistRecords,
  relationRecords,
  releaseRecords,
  render,
  screen,
  seedAuthSessionForTests,
  seedCatalogForTests,
  trackRecords,
  userEvent,
  vi,
  waitFor,
  within,
}

export type FetchMockResponse = Response | Error

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

export function mockFetch(...responses: FetchMockResponse[]) {
  const fetchMock = vi.fn<Window['fetch']>()
  for (const response of responses) {
    if (response instanceof Response) {
      fetchMock.mockResolvedValueOnce(response)
    } else {
      fetchMock.mockRejectedValueOnce(response)
    }
  }
  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

export function searchRequestUrls(fetchMock: ReturnType<typeof mockFetch>) {
  return fetchMock.mock.calls
    .map(([input]) =>
      typeof input === 'string' ? input : (input as Request).url,
    )
    .filter((url) => url.startsWith('/api/search?'))
    .map((url) => new URL(url, window.location.origin))
}

export function emptyCatalogListResponse() {
  return jsonResponse({ items: [], limit: 100, offset: 0, total: 0 })
}

export function defaultDictionaryListResponse() {
  return jsonResponse({
    items: Object.values(defaultCatalogDictionaries).flat(),
    limit: 100,
    offset: 0,
    total: Object.values(defaultCatalogDictionaries).flat().length,
  })
}

export function defaultRatingCriteriaListResponse() {
  return jsonResponse({
    items: defaultRatingCriteria,
    limit: 100,
    offset: 0,
    total: defaultRatingCriteria.length,
  })
}

export function emptyCatalogLoadResponses() {
  return [
    ...Array.from({ length: 9 }, emptyCatalogListResponse),
    defaultDictionaryListResponse(),
    emptyCatalogListResponse(),
    emptyCatalogListResponse(),
  ]
}

export function emptySearchResponse() {
  return jsonResponse({ items: [], limit: 100, offset: 0, total: 0 })
}

export function emptyImportSessionsResponse() {
  return jsonResponse({ items: [], limit: 100, offset: 0, total: 0 })
}

export function importSessionResponse() {
  return jsonResponse({
    items: [
      {
        id: 'import-session-1',
        sourceRoot: '/Users/example/Music',
        status: 'readyForReview',
        draftCount: 1,
        trackCount: 2,
        ignoredFileCount: 0,
        createdAt: '2026-05-16T12:00:00Z',
        updatedAt: '2026-05-16T12:00:00Z',
        drafts: [],
      },
    ],
    limit: 100,
    offset: 0,
    total: 1,
  })
}

export function importSessionDetailWithDuplicateTrack() {
  return jsonResponse({
    id: 'import-session-1',
    sourceRoot: '/Users/example/Music',
    status: 'readyForReview',
    draftCount: 1,
    trackCount: 1,
    ignoredFileCount: 0,
    createdAt: '2026-05-16T12:00:00Z',
    updatedAt: '2026-05-16T12:00:00Z',
    drafts: [
      {
        id: 'draft-1',
        sourcePath: '/Users/example/Music/Release',
        relativePath: 'Release',
        status: 'needsReview',
        title: 'Imported Release',
        type: 'album',
        catalogNumber: null,
        labelName: null,
        releaseDate: null,
        year: 1992,
        isVariousArtists: false,
        notOnLabel: false,
        artistNames: ['Aphex Twin'],
        artistCredits: [],
        selectedArtistIds: [],
        artistSuggestions: [],
        labels: [],
        genres: [],
        tags: [],
        coverPath: null,
        issues: [],
        tracks: [
          {
            id: 'draft-track-1',
            filePath: '/Users/example/Music/Release/01 Polynomial-C.flac',
            relativePath: 'Release/01 Polynomial-C.flac',
            format: 'flac',
            sizeBytes: 12,
            lastModifiedAt: '2026-05-16T12:00:00Z',
            durationSeconds: null,
            position: 1,
            title: 'Polynomial-C',
            artistNames: ['Aphex Twin'],
            artistCredits: [],
            artistSuggestions: [],
            trackSuggestions: [
              {
                id: 'track-existing',
                name: 'Polynomial-C',
                match: 'content hash',
              },
            ],
            isSkipped: false,
            selectedTrackId: 'track-existing',
            selectedArtistIds: [],
            issues: [
              {
                code: 'release_import.duplicate_file',
                message: 'Duplicate file matched an existing track.',
                severity: 'warning',
              },
            ],
          },
        ],
      },
    ],
  })
}

export function stubBrowserExportDownload() {
  const download = { fileName: '', href: '' }
  const createObjectURL = vi.fn(() => 'blob:discweave-export')
  const revokeObjectURL = vi.fn()
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(function (this: HTMLAnchorElement) {
      download.href = this.getAttribute('href') ?? ''
      download.fileName = this.download
    })
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectURL,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeObjectURL,
  })

  return { click, createObjectURL, download, revokeObjectURL }
}

export function catalogLoadResponsesWithLabels() {
  return [
    emptyCatalogListResponse(),
    jsonResponse({
      items: [{ id: 'label-1', name: 'Factory Records' }],
      limit: 100,
      offset: 0,
      total: 1,
    }),
    ...Array.from({ length: 7 }, emptyCatalogListResponse),
    defaultDictionaryListResponse(),
    emptyCatalogListResponse(),
    emptyCatalogListResponse(),
  ]
}

export function searchResponseWithLabel() {
  return jsonResponse({
    items: [
      {
        id: 'label-1',
        type: 'label',
        title: 'Factory Records',
        subtitle: 'Label',
        summary: '1 release · vinyl coverage',
        matchedFields: ['name', 'label releases'],
        snippets: ['Factory Records · Blue Monday'],
        facets: {
          roles: [],
          media: ['Vinyl'],
          statuses: ['Owned'],
          tags: ['post-punk'],
          labelId: 'label-1',
          collectorSignals: ['physicalWithoutDigital'],
        },
        rank: 1,
      },
    ],
    limit: 100,
    offset: 0,
    total: 1,
  })
}

export function searchResponseWithArtist() {
  return jsonResponse({
    items: [
      {
        id: 'artist-1',
        type: 'artist',
        title: 'New Order',
        subtitle: 'Band',
        summary: 'Main artist and relationship graph entry.',
        matchedFields: ['name', 'artist credits'],
        snippets: ['New Order · Blue Monday'],
        facets: {
          roles: ['mainArtist'],
          media: ['Vinyl'],
          statuses: ['Owned'],
          tags: ['post-punk'],
          labelId: null,
          collectorSignals: ['physicalWithoutDigital'],
        },
        rank: 1,
      },
    ],
    limit: 100,
    offset: 0,
    total: 1,
  })
}

export function graphResponseForLabel() {
  return jsonResponse({
    entity: {
      id: 'label-1',
      type: 'label',
      title: 'Factory Records',
      subtitle: 'Label',
      summary: '1 release in the collection.',
    },
    sections: {
      artists: [
        {
          id: 'artist-1',
          type: 'artist',
          title: 'New Order',
          subtitle: 'Band',
          relation: 'Main artist',
        },
      ],
      releases: [
        {
          id: 'release-1',
          type: 'release',
          title: 'Blue Monday',
          subtitle: 'New Order',
          relation: 'Label release',
        },
      ],
      tracks: [],
      ownedCopies: [
        {
          id: 'owned-1',
          type: 'ownedItem',
          title: 'Blue Monday vinyl',
          subtitle: 'Vinyl · Needs digitization',
          relation: 'Owned copy',
        },
      ],
      labels: [],
      playlists: [],
      credits: [],
      relations: [],
      media: [
        {
          id: 'media-vinyl',
          type: 'ownedItem',
          title: 'Vinyl',
          subtitle: '1 copy',
          relation: 'Media coverage',
        },
      ],
    },
    collectorSignals: ['Physical media without digital copy'],
  })
}

export function graphResponseForArtist() {
  return jsonResponse({
    entity: {
      id: 'artist-1',
      type: 'artist',
      title: 'New Order',
      subtitle: 'Band',
      summary: 'Main artist and relationship graph entry.',
    },
    sections: {
      artists: [],
      releases: [
        {
          id: 'release-1',
          type: 'release',
          title: 'Blue Monday',
          subtitle: 'Factory Records',
          relation: 'Main artist',
        },
      ],
      tracks: [
        {
          id: 'track-1',
          type: 'track',
          title: 'Blue Monday',
          subtitle: '12 inch single',
          relation: 'Performer',
        },
      ],
      ownedCopies: [],
      labels: [
        {
          id: 'label-1',
          type: 'label',
          title: 'Factory Records',
          subtitle: 'Label',
          relation: 'Label release',
        },
      ],
      playlists: [],
      credits: [],
      relations: [],
      media: [],
    },
    collectorSignals: ['Physical media without digital copy'],
  })
}

export function setupAppTestHooks() {
  beforeEach(() => {
    window.history.pushState({}, '', '/catalog')
    seedAuthSessionForTests({
      status: 'authenticated',
      session: { email: 'collector@discweave.local', role: 'admin' },
    })
    seedCatalogForTests({
      artists: artistRecords,
      releases: releaseRecords,
      tracks: trackRecords,
      ownedItems: ownedItemRecords,
      relations: relationRecords,
      playlists: playlistRecords,
    })
  })

  afterEach(() => {
    window.discweaveDesktop = undefined
    clearAuthSessionForTests()
    clearCatalogForTests()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
}

export function detailSection(panel: HTMLElement, headingName: string) {
  const heading = within(panel).getByRole('heading', { name: headingName })
  const section = heading.closest('section')

  if (!section) {
    throw new Error(`Missing detail section for heading: ${headingName}`)
  }

  return section
}

export function seedCatalogWithSelectedAmbientCover() {
  seedCatalogForTests({
    artists: artistRecords,
    releases: releaseRecords.map((release) =>
      release.id === 'selected-ambient-works-85-92'
        ? {
            ...release,
            coverImage: {
              url: '/api/releases/selected-ambient-works-85-92/cover-image',
              contentType: 'image/png',
              originalFileName: 'saw-front.png',
              sizeBytes: 512,
              sourceType: 'localUpload',
            },
          }
        : release,
    ),
    tracks: trackRecords,
    ownedItems: ownedItemRecords,
    relations: relationRecords,
    playlists: playlistRecords,
  })
}

export async function addManualArtist(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(screen.getByRole('button', { name: 'Add artist' }))
  const form = screen.getByRole('form', { name: 'Add artist' })
  await user.type(within(form).getByLabelText('Name'), name)
  await user.click(within(form).getByRole('button', { name: 'Add record' }))
}

export async function addReleaseArtist(
  user: ReturnType<typeof userEvent.setup>,
  form: HTMLElement,
  name: string,
  role = 'Main artist',
) {
  await user.type(within(form).getByLabelText('Release artist'), name)
  await user.click(within(form).getByRole('button', { name: 'Add artist' }))
  await user.selectOptions(
    within(form).getByLabelText(`Role for ${name}`),
    role,
  )
}

export async function addReleaseLabel(
  user: ReturnType<typeof userEvent.setup>,
  form: HTMLElement,
  name = 'Session Label',
  catalogNumber = '',
) {
  await user.type(within(form).getByLabelText('Label'), name)
  if (catalogNumber) {
    await user.type(
      within(form).getByLabelText('Catalog number'),
      catalogNumber,
    )
  }
  await user.click(within(form).getByRole('button', { name: 'Add label' }))
}

export async function selectReleaseGenre(
  user: ReturnType<typeof userEvent.setup>,
  form: HTMLElement,
  genre = 'Electronic',
) {
  await user.click(within(form).getByLabelText(`Genre ${genre}`))
}

export async function addReleaseTrackRow(
  user: ReturnType<typeof userEvent.setup>,
  form: HTMLElement,
  title = 'Session Track',
) {
  await user.click(within(form).getByRole('button', { name: '+ Track' }))
  await user.type(within(form).getByLabelText('Track title'), title)
}

export async function selectVisibleOption(
  user: ReturnType<typeof userEvent.setup>,
  select: HTMLElement,
  name: string,
) {
  await user.selectOptions(select, within(select).getByRole('option', { name }))
}
