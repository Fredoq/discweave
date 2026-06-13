import { describe, expect, it } from 'vitest'
import { defaultCatalogDictionaries } from '../catalog/catalogApi'
import { applyDiscogsReleaseToImportDraft } from './importDiscogsApply'

describe('applyDiscogsReleaseToImportDraft', () => {
  it('maps Discogs role names to active import credit role codes', () => {
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
              providerName: 'discogs',
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
    expect(draft.tracks[0].inheritReleaseArtistCredits).toBe(false)
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
              providerName: 'discogs',
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
})
