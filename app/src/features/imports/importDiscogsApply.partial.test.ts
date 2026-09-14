import { describe, expect, it } from 'vitest'
import { defaultCatalogDictionaries } from '../catalog/catalogApi'
import { applyDiscogsReleaseToImportDraft } from './importDiscogsApply'
import { trackMappingFixture } from './importDiscogsApply.testFixtures'

describe('applyDiscogsReleaseToImportDraft partial tracklist', () => {
  it('retains local rows when a Discogs row is skipped', () => {
    const { draft, detail, groups, trackMapping, confirmedMappingKeys } =
      trackMappingFixture()
    const before = structuredClone(draft)
    draft.tracks[0].disc = '1'
    draft.tracks[0].side = 'A'
    detail.draft.tracklist[0].disc = '9'
    detail.draft.tracklist[0].side = 'B'
    before.tracks[0].disc = '1'
    before.tracks[0].side = 'A'
    detail.draft.tracklist.push({
      title: 'Video',
      position: 4,
      artistCredits: [],
    })
    const mapping = [
      ...trackMapping,
      {
        discogsTrackIndex: 3,
        currentTrackId: null,
        currentTrackIndex: null,
        matchKind: 'skipped' as const,
        reason: 'Skipped by user',
      },
    ]

    const result = applyDiscogsReleaseToImportDraft({
      artists: [],
      dictionaries: defaultCatalogDictionaries,
      draft,
      detail,
      groups,
      trackMapping: mapping,
      confirmedMappingKeys,
    })

    expect(result.tracks.map((track) => track.id)).toEqual(
      before.tracks.map((track) => track.id),
    )
    expect(result.tracks.map((track) => track.position)).toEqual(
      before.tracks.map((track) => track.position),
    )
    expect(result.tracks.map((track) => track.localFile)).toEqual(
      before.tracks.map((track) => track.localFile),
    )
    expect(result.tracks[0].title).toBe('Another Chance (Original Mix)')
    expect(result.tracks[0].disc).toBe('1')
    expect(result.tracks[0].side).toBe('A')
  })

  it('preserves effective inherited credits on a kept row when release artists change', () => {
    const { draft, detail, groups, trackMapping, confirmedMappingKeys } =
      trackMappingFixture()
    draft.artistNames = ['Original Artist']
    draft.artistCredits = [
      { artistId: null, name: 'Original Artist', role: 'mainArtist' },
    ]
    draft.tracks[0].inheritReleaseArtistCredits = true
    detail.draft.artistCredits = [{ name: 'New Artist', role: 'mainArtist' }]

    const result = applyDiscogsReleaseToImportDraft({
      artists: [],
      dictionaries: defaultCatalogDictionaries,
      draft,
      detail,
      groups: { ...groups, artists: true },
      keptTrackIds: ['track-1'],
      trackMapping: [
        {
          ...trackMapping[0],
          currentTrackId: null,
          currentTrackIndex: null,
          matchKind: 'skipped',
          reason: 'Skipped by user',
        },
        trackMapping[1],
        trackMapping[2],
      ],
      confirmedMappingKeys,
    })

    expect(result.artistNames).toEqual(['New Artist'])
    expect(result.tracks[0].inheritReleaseArtistCredits).toBe(false)
    expect(result.tracks[0].artistCredits).toEqual([
      {
        artistId: null,
        name: 'Original Artist',
        role: 'mainArtist',
        externalSource: null,
      },
    ])
  })

  it('detects Various Artists against the retained release artists', () => {
    const { apply, draft, detail, trackMapping } = trackMappingFixture()
    draft.artistNames = ['Local Artist']
    draft.artistCredits = [
      { artistId: null, name: 'Local Artist', role: 'mainArtist' },
    ]
    detail.draft.artistCredits = [
      { name: 'Discogs Artist', role: 'mainArtist' },
    ]
    detail.draft.tracklist[0].artistCredits = [
      { name: 'Discogs Artist', role: 'mainArtist' },
    ]

    const result = apply(trackMapping)

    expect(result.isVariousArtists).toBe(true)
    expect(result.tracks[0].inheritReleaseArtistCredits).toBe(false)
    expect(result.tracks[0].artistCredits).toMatchObject([
      { name: 'Discogs Artist', role: 'mainArtist' },
    ])
  })

  it('preserves an unknown kept track year when the Discogs release year is known', () => {
    const { draft, detail, groups, trackMapping, confirmedMappingKeys } =
      trackMappingFixture()
    draft.year = null
    draft.tracks[0].versionYear = null
    detail.draft.year = 2024

    const result = applyDiscogsReleaseToImportDraft({
      artists: [],
      dictionaries: defaultCatalogDictionaries,
      draft,
      detail,
      groups: { ...groups, core: true },
      keptTrackIds: ['track-1'],
      trackMapping: [
        {
          ...trackMapping[0],
          currentTrackId: null,
          currentTrackIndex: null,
          matchKind: 'skipped',
          reason: 'Skipped by user',
        },
        trackMapping[1],
        trackMapping[2],
      ],
      confirmedMappingKeys,
    })

    expect(result.year).toBe(2024)
    expect(result.tracks[0].versionYear).toBeNull()
    expect(
      (result.tracks[0] as { hasExplicitVersionYear?: boolean })
        .hasExplicitVersionYear,
    ).toBe(true)
  })

  it('allows all local rows to stay unchanged when every Discogs row is skipped', () => {
    const { draft, detail, groups, trackMapping } = trackMappingFixture()
    const before = structuredClone(draft)
    const mapping = trackMapping.map((row) => ({
      ...row,
      currentTrackId: null,
      currentTrackIndex: null,
      matchKind: 'skipped' as const,
      reason: 'Skipped by user',
    }))

    const result = applyDiscogsReleaseToImportDraft({
      artists: [],
      dictionaries: defaultCatalogDictionaries,
      draft,
      detail,
      groups,
      keptTrackIds: before.tracks.map((track) => track.id),
      trackMapping: mapping,
    })

    expect(result.tracks).toEqual(
      before.tracks.map((track) => ({
        ...track,
        hasExplicitVersionYear: true,
        versionYear: track.versionYear ?? draft.year ?? null,
      })),
    )
  })

  it('does not apply partial tracklist decisions when Tracklist is unchecked', () => {
    const { draft, detail, groups, trackMapping } = trackMappingFixture()
    const before = structuredClone(draft)
    const mapping = trackMapping.map((row, index) =>
      index === 0
        ? {
            ...row,
            currentTrackId: null,
            currentTrackIndex: null,
            matchKind: 'skipped' as const,
            reason: 'Skipped by user',
          }
        : row,
    )

    const result = applyDiscogsReleaseToImportDraft({
      artists: [],
      dictionaries: defaultCatalogDictionaries,
      draft,
      detail,
      groups: { ...groups, tracklist: false },
      keptTrackIds: ['track-1'],
      trackMapping: mapping,
    })

    expect(result.tracks).toEqual(before.tracks)
  })
})
