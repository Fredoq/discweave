import { describe, expect, it } from 'vitest'
import {
  defaultCatalogDictionaries,
  type ExternalMetadataReleaseDraftArtistCreditDto,
  type ExternalMetadataReleaseDraftTrackDto,
  type ReleaseImportDraft,
} from '../catalog/catalogApi'
import { applyDiscogsReleaseToImportDraft } from './importDiscogsApply'

describe('applyDiscogsReleaseToImportDraft source identity matching', () => {
  it('keeps Discogs sourced same-name artists unselected when no matching source exists', () => {
    const draft = applyDiscogsReleaseToImportDraft({
      artists: [
        {
          id: 'local-robin-stone',
          name: 'Robin Stone',
          type: 'Person',
          identityHint: null,
          aliases: [],
          members: [],
          relationHint: '',
          creditHint: '',
          relations: [],
          credits: [],
          tags: [],
          summary: '',
          externalSources: [],
        },
      ],
      dictionaries: defaultCatalogDictionaries,
      groups: {
        artists: true,
        classification: false,
        core: false,
        labels: false,
        tracklist: false,
      },
      draft: baseDraft(),
      detail: releaseDetail({
        artistCredits: [discogsRobinStone()],
        tracklist: [],
      }),
    })

    expect(draft.artistCredits).toMatchObject([
      {
        artistId: null,
        name: 'Robin Stone',
        role: 'mainArtist',
        externalSource: { externalId: '111' },
      },
    ])
    expect(draft.selectedArtistIds).toEqual([])
  })

  it('matches Discogs sourced artists by source identity ignoring provider and resource casing', () => {
    const draft = applyDiscogsReleaseToImportDraft({
      artists: [
        {
          id: 'local-robin-stone',
          name: 'Robin Stone',
          type: 'Person',
          identityHint: null,
          aliases: [],
          members: [],
          relationHint: '',
          creditHint: '',
          relations: [],
          credits: [],
          tags: [],
          summary: '',
          externalSources: [
            {
              providerName: 'Discogs',
              resourceType: 'Artist',
              externalId: '111',
              sourceUrl: 'https://www.discogs.com/artist/111',
            },
          ],
        },
      ],
      dictionaries: defaultCatalogDictionaries,
      groups: {
        artists: true,
        classification: false,
        core: false,
        labels: false,
        tracklist: false,
      },
      draft: baseDraft(),
      detail: releaseDetail({
        artistCredits: [discogsRobinStone()],
        tracklist: [],
      }),
    })

    expect(draft.artistCredits).toMatchObject([
      {
        artistId: 'local-robin-stone',
        name: 'Robin Stone',
        role: 'mainArtist',
        externalSource: {
          providerName: 'discogs',
          resourceType: 'artist',
          externalId: '111',
        },
      },
    ])
    expect(draft.selectedArtistIds).toEqual(['local-robin-stone'])
  })

  it('inherits release artist credits by name when only the tracklist update has a source identity', () => {
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
        ...baseDraft(),
        artistCredits: [
          { artistId: null, name: 'Robin Stone', role: 'mainArtist' },
        ],
        tracks: [
          {
            id: 'track-1',
            filePath: '/Music/Release/01 Show Me Love.flac',
            relativePath: '01 Show Me Love.flac',
            format: 'flac',
            sizeBytes: 100,
            lastModifiedAt: '2026-06-01T12:00:00Z',
            durationSeconds: 248,
            position: 1,
            disc: null,
            side: null,
            title: 'Show Me Love',
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
      detail: releaseDetail({
        artistCredits: [{ name: 'Robin Stone', role: 'mainArtist' }],
        tracklist: [
          {
            title: 'Show Me Love',
            position: 1,
            disc: null,
            side: null,
            durationSeconds: 248,
            artistCredits: [discogsRobinStone()],
          },
        ],
      }),
    })

    expect(draft.tracks[0].inheritReleaseArtistCredits).toBe(true)
    expect(draft.tracks[0].artistCredits).toEqual([])
  })
})

function discogsRobinStone() {
  return {
    name: 'Robin Stone',
    role: 'mainArtist',
    externalSource: {
      providerName: 'discogs',
      resourceType: 'artist',
      externalId: '111',
      sourceUrl: 'https://www.discogs.com/artist/111',
    },
  }
}

function releaseDetail({
  artistCredits,
  tracklist,
}: {
  artistCredits: ExternalMetadataReleaseDraftArtistCreditDto[]
  tracklist: ExternalMetadataReleaseDraftTrackDto[]
}) {
  return {
    source: {
      providerName: 'discogs',
      resourceType: 'release',
      externalId: '123',
      sourceUrl: 'https://www.discogs.com/release/123',
      attribution: 'Data provided by Discogs.',
    },
    title: 'Show Me Love',
    artists: ['Robin Stone'],
    year: 1993,
    trackCount: 1,
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
      year: 1993,
      releaseDate: null,
      artistCredits,
      labels: [],
      tracklist,
      externalSources: [],
    },
  }
}

function baseDraft(): ReleaseImportDraft {
  return {
    id: 'draft-1',
    sourcePath: '/Music/Release',
    relativePath: 'Release',
    status: 'needsReview',
    title: 'Local Release',
    type: 'single',
    catalogNumber: null,
    labelName: null,
    releaseDate: null,
    year: 1993,
    isVariousArtists: false,
    notOnLabel: true,
    artistNames: [],
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
  }
}
