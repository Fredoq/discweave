import { toPlaylistRequest } from '../catalog/api/playlistMappers'
import { describe, expect, it, vi } from 'vitest'
import type { ReleaseRecord } from '../releases/releasesData'
import type { TrackRecord } from '../tracks/tracksData'
import type { PlaylistRecord } from './playlistsData'
import {
  createTrackOnlyPlaylistCopy,
  playlistTrackFromRecord,
  projectPlaylistTracks,
} from './playlistBuilderModel'

function track(id: string): TrackRecord {
  return {
    id,
    title: id,
    artist: 'Demo artist',
    release: {
      title: 'Demo release',
      artist: 'Demo artist',
      year: '',
      label: '',
    },
    trackNumber: '',
    duration: '3:00',
    relationHint: '',
    tags: [],
    credits: [],
    releaseAppearances: [],
    relations: [],
    digitalFiles: [],
  }
}
const tracks = [track('A'), track('B')]
function playlist(): PlaylistRecord {
  return {
    id: 'original',
    name: 'Demo',
    description: 'Preserve me',
    type: 'Manual',
    curator: '',
    updatedAt: '',
    yearRange: '',
    ruleHints: [],
    linkedReleases: [],
    tracks: [],
    serverEntries: [
      { kind: 'track', id: 'A' },
      { kind: 'release', id: 'R' },
      { kind: 'track', id: 'A' },
    ],
    manualSelection: { source: '', note: '' },
  }
}
function release(): ReleaseRecord {
  return {
    id: 'R',
    title: 'Demo album',
    artist: 'Demo artist',
    type: 'Album',
    year: '',
    label: '',
    genres: [],
    tags: [],
    releaseNotes: '',
    ownedCopies: [],
    tracklist: [
      {
        trackId: 'B',
        title: 'B appearance',
        position: '2',
        disc: '2',
        isReleaseOnly: false,
        artistCredits: [],
      },
      {
        trackId: 'A',
        title: 'A appearance',
        position: '1',
        disc: '1',
        isReleaseOnly: false,
        artistCredits: [],
      },
      {
        trackId: 'B',
        title: 'B repeat',
        position: '3',
        isReleaseOnly: false,
        artistCredits: [],
      },
    ],
  }
}

describe('playlist track projection', () => {
  it('preserves authoritative mixed entry order, release row order and repeated occurrences without mutation', () => {
    const original = playlist()
    const album = release()
    const snapshot = structuredClone({ original, album, tracks })
    const result = projectPlaylistTracks(original, [album], tracks)
    expect(result.rows.map((row) => row.trackId)).toEqual([
      'A',
      'B',
      'A',
      'B',
      'A',
    ])
    expect(new Set(result.rows.map((row) => row.key)).size).toBe(5)
    expect(result).toMatchObject({ legacy: true, canCopy: true, problems: [] })
    expect({ original, album, tracks }).toEqual(snapshot)
  })
  it('treats an empty serverEntries list as authoritative', () => {
    const original = playlist()
    original.serverEntries = []
    original.tracks = [playlistTrackFromRecord(tracks[0])]
    expect(projectPlaylistTracks(original, [release()], tracks).rows).toEqual(
      [],
    )
  })
  it('projects A B A as three independent occurrences', () => {
    const original = playlist()
    original.serverEntries = ['A', 'B', 'A'].map((id) => ({
      kind: 'track',
      id,
    }))
    const result = projectPlaylistTracks(original, [], tracks)
    expect(result.rows.map((row) => row.trackId)).toEqual(['A', 'B', 'A'])
    expect(result.legacy).toBe(false)
  })
  it('blocks incomplete, missing and empty release tracklists', () => {
    for (const releases of [
      [],
      [{ ...release(), tracklist: undefined }],
      [{ ...release(), tracklist: [] }],
    ]) {
      const result = projectPlaylistTracks(playlist(), releases, tracks)
      expect(result.canCopy).toBe(false)
      expect(result.problems.join(' ')).toContain('tracklist')
      expect(
        createTrackOnlyPlaylistCopy(playlist(), result, 'copy'),
      ).toBeUndefined()
    }
  })
  it('shows release-only rows but blocks conversion, even with inconsistent trackId', () => {
    const album = release()
    album.tracklist![0].isReleaseOnly = true
    const result = projectPlaylistTracks(playlist(), [album], tracks)
    expect(result.rows[1]).toMatchObject({
      title: 'B appearance',
      trackId: undefined,
    })
    expect(result.canCopy).toBe(false)
    expect(result.problems[0]).toContain('standalone track')
  })
  it('keeps known labels for missing track records and blocks copying', () => {
    const original = playlist()
    original.serverEntries = [
      {
        kind: 'track',
        id: 'missing',
        title: 'Known title',
        subtitle: 'Known artist',
      },
    ]
    const result = projectPlaylistTracks(original, [], tracks)
    expect(result.rows[0]).toMatchObject({
      title: 'Known title',
      artist: 'Known artist',
      trackId: 'missing',
    })
    expect(result.canCopy).toBe(false)
  })
  it('blocks release row ids that cannot be resolved, including absent ids', () => {
    for (const id of [undefined, 'missing']) {
      const album = release()
      album.tracklist![0].trackId = id
      expect(projectPlaylistTracks(playlist(), [album], tracks).canCopy).toBe(
        false,
      )
    }
  })
  it('does not assume the original mixed order for old incomplete view models', () => {
    const original = playlist()
    original.serverEntries = undefined
    original.linkedReleases = [
      {
        releaseId: 'R',
        title: 'Demo album',
        artist: '',
        year: '',
        media: [],
        ownershipStatus: [],
        availability: '',
      },
    ]
    const result = projectPlaylistTracks(original, [release()], tracks)
    expect(result.canCopy).toBe(false)
    expect(result.problems.join(' ')).toContain('original entry order')
  })
  it('creates an independent manual draft with all occurrences and no rules', () => {
    const original = playlist()
    original.serverRules = {
      tags: ['keep'],
      genres: [],
      media: [],
      ownershipStatuses: [],
    }
    const snapshot = structuredClone(original)
    const copy = createTrackOnlyPlaylistCopy(
      original,
      projectPlaylistTracks(original, [release()], tracks),
      'copy',
    )!
    expect(copy.id).toBe('copy')
    expect(copy.description).toBe(original.description)
    expect(copy.serverEntries?.map((entry) => entry.id)).toEqual([
      'A',
      'B',
      'A',
      'B',
      'A',
    ])
    expect(copy.serverEntries?.every((entry) => entry.kind === 'track')).toBe(
      true,
    )
    expect(copy.linkedReleases).toEqual([])
    expect(copy.serverRules).toBeUndefined()
    copy.serverEntries![0].id = 'changed'
    expect(original).toEqual(snapshot)
    expect(
      createTrackOnlyPlaylistCopy(
        original,
        projectPlaylistTracks(original, [release()], tracks),
        original.id,
      ),
    ).toBeUndefined()
  })
  it('keeps copy occurrences independent when reordered and one repeat is removed', () => {
    const original = playlist()
    original.serverEntries = ['A', 'B', 'A'].map((id) => ({
      kind: 'track',
      id,
    }))
    const copy = createTrackOnlyPlaylistCopy(
      original,
      projectPlaylistTracks(original, [], tracks),
      'copy',
    )!
    const entries = copy.serverEntries!
    ;[entries[0], entries[1]] = [entries[1], entries[0]]
    entries.splice(1, 1)
    expect(entries.map((entry) => entry.id)).toEqual(['B', 'A'])
    expect(original.serverEntries.map((entry) => entry.id)).toEqual([
      'A',
      'B',
      'A',
    ])
  })
  it('uses evaluated Smart tracks without changing its rules or offering conversion', () => {
    const smart: PlaylistRecord = {
      ...playlist(),
      type: 'Smart',
      tracks: [playlistTrackFromRecord(tracks[1])],
      serverEntries: [],
      smartRules: { summary: 'Keep rules', criteria: ['Ambient'] },
    }
    const snapshot = structuredClone(smart)
    const result = projectPlaylistTracks(smart, [], tracks)
    expect(result.rows.map((row) => row.trackId)).toEqual(['B'])
    expect(result.canCopy).toBe(false)
    expect(createTrackOnlyPlaylistCopy(smart, result, 'copy')).toBeUndefined()
    expect(smart).toEqual(snapshot)
  })
})

describe('playlist request preservation', () => {
  const a = '11111111-1111-4111-8111-111111111111'
  const b = '22222222-2222-4222-8222-222222222222'
  it('serializes A B A and preserves a separate legacy original when copying', () => {
    const original = playlist()
    original.serverEntries = [
      { kind: 'track', id: a },
      { kind: 'release', id: b },
      { kind: 'track', id: a },
    ]
    const album = release()
    album.id = b
    album.tracklist = [
      {
        trackId: b,
        isReleaseOnly: false,
        title: 'B',
        position: '1',
        artistCredits: [],
      },
    ]
    const snapshot = structuredClone(original)
    const copy = createTrackOnlyPlaylistCopy(
      original,
      projectPlaylistTracks(original, [album], [track(a), track(b)]),
      'copy',
    )!
    expect(toPlaylistRequest(copy).entries).toEqual([
      { kind: 'track', id: a },
      { kind: 'track', id: b },
      { kind: 'track', id: a },
    ])
    expect(toPlaylistRequest(original).entries).toEqual(snapshot.serverEntries)
    expect(original).toEqual(snapshot)
  })
  it('serializes explicit clearing instead of resurrecting stale view-model tracks', () => {
    const original = playlist()
    original.serverEntries = []
    original.tracks = [playlistTrackFromRecord(track(a))]
    original.linkedReleases = [
      {
        releaseId: b,
        title: 'Old release',
        artist: '',
        year: '',
        media: [],
        ownershipStatus: [],
        availability: '',
      },
    ]
    expect(toPlaylistRequest(original).entries).toEqual([])
  })
  it.each(['explicit', 'fallback'] as const)(
    'rejects unsaved %s references before sending a request, without silently dropping entries',
    (source) => {
      const original = playlist()
      original.serverEntries =
        source === 'explicit'
          ? [
              { kind: 'track', id: a },
              { kind: 'track', id: 'manual-track-unsaved' },
            ]
          : undefined
      original.tracks = [
        playlistTrackFromRecord(track(a)),
        playlistTrackFromRecord(track('manual-track-unsaved')),
      ]
      const snapshot = structuredClone(original)
      const sendRequest =
        vi.fn<(request: ReturnType<typeof toPlaylistRequest>) => void>()
      expect(() => sendRequest(toPlaylistRequest(original))).toThrow(
        'No playlist changes were sent',
      )
      expect(sendRequest).not.toHaveBeenCalled()
      expect(original).toEqual(snapshot)
    },
  )
  it('preserves every Smart server rule through the request mapper', () => {
    const smart: PlaylistRecord = {
      ...playlist(),
      type: 'Smart',
      smartRules: { summary: 'Summary', criteria: ['Display only'] },
      serverRules: {
        tags: ['Tag'],
        genres: ['Ambient'],
        media: ['Vinyl'],
        ownershipStatuses: ['Owned'],
        yearFrom: 1990,
        yearTo: 2005,
      },
    }
    const snapshot = structuredClone(smart)
    const request = toPlaylistRequest(smart)
    expect(request.type).toBe('smart')
    expect(request.entries).toEqual([])
    expect(request.rules).toEqual(snapshot.serverRules)
    expect(smart).toEqual(snapshot)
  })
})
