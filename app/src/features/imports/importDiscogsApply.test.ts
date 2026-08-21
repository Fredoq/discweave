import { describe, expect, it } from 'vitest'
import {
  defaultCatalogDictionaries,
  type ExternalMetadataReleaseDetailDto,
  type ReleaseImportDraft,
} from '../catalog/catalogApi'
import { buildDiscogsTrackMapping } from '../releases/discogsTrackMapping'
import { applyDiscogsReleaseToImportDraft } from './importDiscogsApply'

function trackMappingFixture() {
  // prettier-ignore
  const track = (id: string, title: string, relativePath: string, position: number) => ({ id, sourceKind: 'localFiles', title, relativePath, position }) as unknown as ReleaseImportDraft['tracks'][number]
  // prettier-ignore
  const currentTitles = ['Another Chance (Original Edit)', 'Another Chance (Afterlife Mix)', "Another Chance (S-Man's Dark Nite Mix)"]
  // prettier-ignore
  const discogsTitles = ['Another Chance (Original Mix)', "Another Chance (S-Man's Dark Nite Mix)", 'Another Chance (Afterlife Mix)']
  // prettier-ignore
  const currentTracks = currentTitles.map((title, index) => ({ id: `track-${index + 1}`, title, fileName: `${String(index + 1).padStart(2, '0')} ${title}.m4a`, position: index + 1 }))
  // prettier-ignore
  const draft = { artistNames: [], artistCredits: [], selectedArtistIds: [], isVariousArtists: false, tracks: currentTitles.map((title, index) => track(`track-${index + 1}`, title, `${String(index + 1).padStart(2, '0')} ${title}.m4a`, index + 1)) } as unknown as ReleaseImportDraft
  // prettier-ignore
  const detail = { draft: { artistCredits: [], externalSources: [], tracklist: discogsTitles.map((title, position) => ({ title, position: position + 1, artistCredits: [] })) } } as unknown as ExternalMetadataReleaseDetailDto
  const trackMapping = buildDiscogsTrackMapping(
    currentTracks,
    detail.draft.tracklist,
  )
  // prettier-ignore
  const groups = { artists: false, classification: false, core: false, labels: false, tracklist: true }
  // prettier-ignore
  const apply = (mapping: typeof trackMapping) => applyDiscogsReleaseToImportDraft({ artists: [], detail, dictionaries: defaultCatalogDictionaries, draft, groups, trackMapping: mapping })
  return { apply, trackMapping }
}

describe('applyDiscogsReleaseToImportDraft', () => {
  it('moves local file bindings with their reviewed Discogs track rows', () => {
    const { apply, trackMapping } = trackMappingFixture()
    const result = apply(trackMapping)
    expect(result.tracks.map((track) => track.id)).toEqual([
      'track-1',
      'track-3',
      'track-2',
    ])
    expect(result.tracks.map((track) => track.title)).toEqual([
      'Another Chance (Original Mix)',
      "Another Chance (S-Man's Dark Nite Mix)",
      'Another Chance (Afterlife Mix)',
    ])
    expect(result.tracks.map((track) => track.relativePath)).toEqual([
      '01 Another Chance (Original Edit).m4a',
      "03 Another Chance (S-Man's Dark Nite Mix).m4a",
      '02 Another Chance (Afterlife Mix).m4a',
    ])
  })

  it.each([
    ['duplicate current ID', { currentTrackId: 'track-1' }],
    ['stale current ID', { currentTrackId: 'missing-track' }],
    ['out-of-range Discogs index', { discogsTrackIndex: 3 }],
    ['missing row', undefined],
  ])('rejects %s mappings without applying Tracklist', (_label, change) => {
    const { apply, trackMapping } = trackMappingFixture()
    const invalidMapping = change
      ? [trackMapping[0], { ...trackMapping[1], ...change }, trackMapping[2]]
      : trackMapping.slice(0, 2)

    expect(() => apply(invalidMapping)).toThrow(
      'Discogs track mapping must be complete and one-to-one.',
    )
  })

  it('keeps Discogs track-specific credits while inheriting release artists for non-Various-Artists drafts', () => {
    const draft = applyDiscogsReleaseToImportDraft({
      artists: [],
      dictionaries: defaultCatalogDictionaries,
      groups: {
        artists: false,
        classification: false,
        core: false,
        labels: false,
        tracklist: true,
      },
      draft: {
        id: 'draft-1',
        sourceKind: 'localFiles',
        sourcePath: '/Music/Release',
        relativePath: 'Release',
        status: 'needsReview',
        title: 'Local Release',
        type: 'album',
        catalogNumber: null,
        labelName: null,
        releaseDate: null,
        year: 1992,
        isVariousArtists: false,
        notOnLabel: true,
        artistNames: ['Robin S'],
        artistCredits: [
          { artistId: null, name: 'Robin S', role: 'mainArtist' },
        ],
        selectedArtistIds: [],
        artistSuggestions: [],
        labels: [],
        genres: [],
        tags: [],
        externalSources: [],
        coverPath: null,
        issues: [],
        tracks: [
          {
            id: 'track-1',
            sourceKind: 'localFiles',
            localFile: {
              filePath: '/Music/Release/01 Show Me Love.m4a',
              relativePath: '01 Show Me Love.m4a',
              format: 'm4a',
              sizeBytes: 100,
              lastModifiedAt: '2026-06-01T12:00:00Z',
            },
            filePath: '/Music/Release/01 Show Me Love.m4a',
            relativePath: '01 Show Me Love.m4a',
            format: 'm4a',
            sizeBytes: 100,
            lastModifiedAt: '2026-06-01T12:00:00Z',
            durationSeconds: 300,
            position: 1,
            disc: null,
            side: null,
            title: 'Show Me Love',
            artistNames: ['Robin S'],
            artistCredits: [],
            artistSuggestions: [],
            trackSuggestions: [],
            isSkipped: false,
            selectedTrackId: null,
            selectedArtistIds: [],
            inheritReleaseArtistCredits: false,
            issues: [],
          },
        ],
      },
      detail: {
        source: {
          providerName: 'discogs',
          resourceType: 'release',
          externalId: '123',
          sourceUrl: 'https://www.discogs.com/release/123',
          attribution: 'Data provided by Discogs.',
        },
        title: 'Show Me Love',
        artists: ['Robin S'],
        year: 1992,
        trackCount: 1,
        labels: ['Champion'],
        formats: ['Vinyl'],
        catalogNumber: 'CHAMP 12 300',
        barcodes: [],
        tracklist: [],
        identifiers: [],
        credits: [],
        draft: {
          title: 'Show Me Love',
          type: 'single',
          genres: ['House'],
          year: 1992,
          releaseDate: null,
          artistCredits: [{ name: 'Robin S', role: 'mainArtist' }],
          labels: [],
          tracklist: [
            {
              title: 'Show Me Love (Stonebridge Club Mix)',
              position: 1,
              disc: null,
              side: 'A',
              durationSeconds: 300,
              artistCredits: [{ name: 'StoneBridge', role: 'Remix' }],
            },
          ],
          externalSources: [
            {
              providerCode: 'discogs',
              resourceType: 'release',
              externalId: '123',
              sourceUrl: 'https://www.discogs.com/release/123',
            },
          ],
        },
      },
    })

    expect(draft.tracks[0].artistCredits).toMatchObject([
      { name: 'StoneBridge', role: 'remixer' },
    ])
    expect(draft.tracks[0].inheritReleaseArtistCredits).toBe(true)
  })

  it('keeps local audio duration when Discogs track duration is missing', () => {
    const draft = applyDiscogsReleaseToImportDraft({
      artists: [],
      dictionaries: defaultCatalogDictionaries,
      groups: {
        artists: false,
        classification: false,
        core: false,
        labels: false,
        tracklist: true,
      },
      draft: {
        id: 'draft-1',
        sourceKind: 'localFiles',
        sourcePath: '/Music/Release',
        relativePath: 'Release',
        status: 'needsReview',
        title: 'Local Release',
        type: 'single',
        catalogNumber: null,
        labelName: null,
        releaseDate: null,
        year: 1990,
        isVariousArtists: false,
        notOnLabel: true,
        artistNames: ['Robin Stone'],
        artistCredits: [
          { artistId: null, name: 'Robin Stone', role: 'mainArtist' },
        ],
        selectedArtistIds: [],
        artistSuggestions: [],
        labels: [],
        genres: [],
        tags: [],
        externalSources: [],
        coverPath: null,
        issues: [],
        tracks: [
          {
            id: 'track-1',
            sourceKind: 'localFiles',
            localFile: {
              filePath: '/Music/Release/01 Show Me Love (Montego Mix).flac',
              relativePath: '01 Show Me Love (Montego Mix).flac',
              format: 'flac',
              sizeBytes: 100,
              lastModifiedAt: '2026-06-01T12:00:00Z',
            },
            filePath: '/Music/Release/01 Show Me Love (Montego Mix).flac',
            relativePath: '01 Show Me Love (Montego Mix).flac',
            format: 'flac',
            sizeBytes: 100,
            lastModifiedAt: '2026-06-01T12:00:00Z',
            durationSeconds: 336,
            position: 1,
            disc: null,
            side: null,
            title: 'Show Me Love (Montego Mix)',
            artistNames: ['Robin Stone'],
            artistCredits: [],
            artistSuggestions: [],
            trackSuggestions: [],
            isSkipped: false,
            selectedTrackId: null,
            selectedArtistIds: [],
            inheritReleaseArtistCredits: false,
            issues: [],
          },
        ],
      },
      detail: {
        source: {
          providerName: 'discogs',
          resourceType: 'release',
          externalId: '456',
          sourceUrl: 'https://www.discogs.com/release/456',
          attribution: 'Data provided by Discogs.',
        },
        title: 'Show Me Love',
        artists: ['Robin Stone'],
        year: 1990,
        trackCount: 1,
        labels: ['Champion'],
        formats: ['Vinyl'],
        catalogNumber: 'CHAMP 12 300',
        barcodes: [],
        tracklist: [],
        identifiers: [],
        credits: [],
        draft: {
          title: 'Show Me Love',
          type: 'single',
          genres: [],
          year: 1990,
          releaseDate: null,
          artistCredits: [{ name: 'Robin Stone', role: 'mainArtist' }],
          labels: [],
          tracklist: [
            {
              title: 'Show Me Love (Montego Mix)',
              position: 1,
              disc: null,
              side: 'A',
              durationSeconds: null,
              artistCredits: [],
            },
          ],
          externalSources: [],
        },
      },
    })

    expect(draft.tracks[0].durationSeconds).toBe(336)
  })

  it('turns matching Discogs track main artists into release artist inheritance', () => {
    const draft = applyDiscogsReleaseToImportDraft({
      artists: [],
      dictionaries: defaultCatalogDictionaries,
      groups: {
        artists: true,
        classification: true,
        core: false,
        labels: false,
        tracklist: true,
      },
      draft: {
        id: 'draft-1',
        sourceKind: 'localFiles',
        sourcePath: '/Music/Release',
        relativePath: 'Release',
        status: 'needsReview',
        title: 'Local Release',
        type: 'album',
        catalogNumber: null,
        labelName: null,
        releaseDate: null,
        year: 1992,
        isVariousArtists: false,
        notOnLabel: true,
        artistNames: ['Robin S'],
        artistCredits: [
          { artistId: null, name: 'Robin S', role: 'mainArtist' },
        ],
        selectedArtistIds: [],
        artistSuggestions: [],
        labels: [],
        genres: [],
        tags: ['local-tag'],
        externalSources: [],
        coverPath: null,
        issues: [],
        tracks: [
          {
            id: 'track-1',
            sourceKind: 'localFiles',
            localFile: {
              filePath: '/Music/Release/01 Show Me Love.m4a',
              relativePath: '01 Show Me Love.m4a',
              format: 'm4a',
              sizeBytes: 100,
              lastModifiedAt: '2026-06-01T12:00:00Z',
            },
            filePath: '/Music/Release/01 Show Me Love.m4a',
            relativePath: '01 Show Me Love.m4a',
            format: 'm4a',
            sizeBytes: 100,
            lastModifiedAt: '2026-06-01T12:00:00Z',
            durationSeconds: 300,
            position: 1,
            disc: null,
            side: null,
            title: 'Show Me Love',
            artistNames: ['Robin S'],
            artistCredits: [],
            artistSuggestions: [],
            trackSuggestions: [],
            isSkipped: false,
            selectedTrackId: null,
            selectedArtistIds: [],
            inheritReleaseArtistCredits: false,
            issues: [],
          },
        ],
      },
      detail: {
        source: {
          providerName: 'discogs',
          resourceType: 'release',
          externalId: '123',
          sourceUrl: 'https://www.discogs.com/release/123',
          attribution: 'Data provided by Discogs.',
        },
        title: 'Show Me Love',
        artists: ['Robin S'],
        year: 1992,
        trackCount: 1,
        labels: ['Champion'],
        formats: ['Vinyl'],
        catalogNumber: 'CHAMP 12 300',
        barcodes: [],
        tracklist: [],
        identifiers: [],
        credits: [],
        draft: {
          title: 'Show Me Love',
          type: 'single',
          genres: ['Genre House', 'Garage House'],
          year: 1992,
          releaseDate: null,
          artistCredits: [{ name: 'Robin S', role: 'mainArtist' }],
          labels: [],
          tracklist: [
            {
              title: 'Show Me Love (Stonebridge Club Mix)',
              position: 1,
              disc: null,
              side: 'A',
              durationSeconds: 300,
              artistCredits: [
                { name: 'Robin S', role: 'mainArtist' },
                { name: 'StoneBridge', role: 'Remix' },
              ],
            },
          ],
          externalSources: [
            {
              providerCode: 'discogs',
              resourceType: 'release',
              externalId: '123',
              sourceUrl: 'https://www.discogs.com/release/123',
            },
          ],
        },
      },
    })

    expect(draft.isVariousArtists).toBe(false)
    expect(draft.genres).toEqual(['House', 'Garage House'])
    expect(draft.tags).toEqual(['local-tag'])
    expect(draft.tracks[0].inheritReleaseArtistCredits).toBe(true)
    expect(draft.tracks[0].artistCredits).toMatchObject([
      { name: 'StoneBridge', role: 'remixer' },
    ])
  })

  it('keeps overlapping Discogs track main artists explicit for Various Artists drafts', () => {
    const draft = applyDiscogsReleaseToImportDraft({
      artists: [],
      dictionaries: defaultCatalogDictionaries,
      groups: {
        artists: true,
        classification: false,
        core: false,
        labels: false,
        tracklist: true,
      },
      draft: {
        id: 'draft-1',
        sourceKind: 'localFiles',
        sourcePath: '/Music/Release',
        relativePath: 'Release',
        status: 'needsReview',
        title: 'Local Release',
        type: 'album',
        catalogNumber: null,
        labelName: null,
        releaseDate: null,
        year: 1992,
        isVariousArtists: false,
        notOnLabel: true,
        artistNames: ['Robin S'],
        artistCredits: [
          { artistId: null, name: 'Robin S', role: 'mainArtist' },
        ],
        selectedArtistIds: [],
        artistSuggestions: [],
        labels: [],
        genres: [],
        tags: [],
        externalSources: [],
        coverPath: null,
        issues: [],
        tracks: [
          {
            id: 'track-1',
            sourceKind: 'localFiles',
            localFile: {
              filePath: '/Music/Release/01 Show Me Love.m4a',
              relativePath: '01 Show Me Love.m4a',
              format: 'm4a',
              sizeBytes: 100,
              lastModifiedAt: '2026-06-01T12:00:00Z',
            },
            filePath: '/Music/Release/01 Show Me Love.m4a',
            relativePath: '01 Show Me Love.m4a',
            format: 'm4a',
            sizeBytes: 100,
            lastModifiedAt: '2026-06-01T12:00:00Z',
            durationSeconds: 300,
            position: 1,
            disc: null,
            side: null,
            title: 'Show Me Love',
            artistNames: ['Robin S'],
            artistCredits: [],
            artistSuggestions: [],
            trackSuggestions: [],
            isSkipped: false,
            selectedTrackId: null,
            selectedArtistIds: [],
            inheritReleaseArtistCredits: false,
            issues: [],
          },
          {
            id: 'track-2',
            sourceKind: 'localFiles',
            localFile: {
              filePath: '/Music/Release/02 Other.m4a',
              relativePath: '02 Other.m4a',
              format: 'm4a',
              sizeBytes: 100,
              lastModifiedAt: '2026-06-01T12:00:00Z',
            },
            filePath: '/Music/Release/02 Other.m4a',
            relativePath: '02 Other.m4a',
            format: 'm4a',
            sizeBytes: 100,
            lastModifiedAt: '2026-06-01T12:00:00Z',
            durationSeconds: 300,
            position: 2,
            disc: null,
            side: null,
            title: 'Other',
            artistNames: ['Other Artist'],
            artistCredits: [],
            artistSuggestions: [],
            trackSuggestions: [],
            isSkipped: false,
            selectedTrackId: null,
            selectedArtistIds: [],
            inheritReleaseArtistCredits: false,
            issues: [],
          },
        ],
      },
      detail: {
        source: {
          providerName: 'discogs',
          resourceType: 'release',
          externalId: '123',
          sourceUrl: 'https://www.discogs.com/release/123',
          attribution: 'Data provided by Discogs.',
        },
        title: 'Show Me Love',
        artists: ['Robin S'],
        year: 1992,
        trackCount: 2,
        labels: [],
        formats: [],
        catalogNumber: null,
        barcodes: [],
        tracklist: [],
        identifiers: [],
        credits: [],
        draft: {
          title: 'Show Me Love',
          type: 'single',
          genres: [],
          year: 1992,
          releaseDate: null,
          artistCredits: [{ name: 'Robin S', role: 'mainArtist' }],
          labels: [],
          tracklist: [
            {
              title: 'Show Me Love',
              position: 1,
              disc: null,
              side: 'A',
              durationSeconds: 300,
              artistCredits: [{ name: 'Robin S', role: 'mainArtist' }],
            },
            {
              title: 'Other',
              position: 2,
              disc: null,
              side: 'B',
              durationSeconds: 300,
              artistCredits: [{ name: 'Other Artist', role: 'mainArtist' }],
            },
          ],
          externalSources: [],
        },
      },
    })

    expect(draft.isVariousArtists).toBe(true)
    expect(draft.tracks[0].inheritReleaseArtistCredits).toBe(false)
    expect(draft.tracks[0].artistCredits).toMatchObject([
      { name: 'Robin S', role: 'mainArtist' },
    ])
  })
})
