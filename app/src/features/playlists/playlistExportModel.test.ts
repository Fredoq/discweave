import { describe, expect, it } from 'vitest'
import type { TrackDigitalFile, TrackRecord } from '../tracks/tracksData'
import { playlistTrackFromRecord } from './playlistBuilderModel'
import { createPlaylistExportRows } from './playlistExportModel'
import type { PlaylistRecord } from './playlistsData'

function file(id: string, path: string): TrackDigitalFile {
  return {
    localAudioFileId: id,
    digitalTrackFileLinkId: `link-${id}`,
    digitalOwnedItemId: 'copy',
    releaseId: 'release',
    releaseTitle: 'Demo album',
    releaseTrackId: `release-track-${id}`,
    position: '1',
    path,
    format: 'FLAC',
    codec: 'FLAC',
    quality: '',
    contentHash: '',
    duration: '3:00',
    bitrate: '',
    sampleRate: '',
    channels: '',
  }
}
function track(id: string, files: TrackDigitalFile[] = []): TrackRecord {
  return {
    id,
    title: `Track ${id}`,
    artist: 'Demo artist',
    release: {
      title: 'Demo album',
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
    digitalFiles: files,
  }
}
function playlist(): PlaylistRecord {
  return {
    id: 'playlist',
    name: 'Demo selection',
    description: '',
    type: 'Manual',
    curator: '',
    updatedAt: '',
    yearRange: '',
    ruleHints: [],
    tracks: [],
    linkedReleases: [],
    serverEntries: ['A', 'B', 'A'].map((id) => ({
      kind: 'track' as const,
      id,
    })),
    manualSelection: { source: '', note: '' },
  }
}

describe('playlist export row preparation', () => {
  it('preserves exact occurrence order, repeats, and independent row identities', () => {
    const rows = createPlaylistExportRows(playlist(), [track('B'), track('A')])
    expect(rows.map((row) => row.trackId)).toEqual(['A', 'B', 'A'])
    expect(new Set(rows.map((row) => row.key)).size).toBe(3)
    expect(rows[0]).toMatchObject({
      title: 'Track A',
      artist: 'Demo artist',
      duration: '3:00',
    })
  })

  it('keeps unavailable references as rows instead of silently skipping them', () => {
    const source = playlist()
    source.serverEntries = [
      {
        kind: 'track',
        id: 'missing',
        title: 'Recorded title',
        subtitle: 'Recorded artist',
      },
    ]
    expect(createPlaylistExportRows(source, [])).toEqual([
      {
        key: 'entry-0',
        trackId: 'missing',
        title: 'Recorded title',
        artist: 'Recorded artist',
        duration: '',
        files: [],
      },
    ])
    source.serverEntries = [{ kind: 'track', id: 'missing' }]
    expect(createPlaylistExportRows(source, [])[0].title).toBe('missing')
  })

  it('treats an explicit empty selection as authoritative over stale fallback references', () => {
    const source = playlist()
    source.serverEntries = []
    source.tracks = [playlistTrackFromRecord(track('A'))]
    source.linkedReleases = [
      {
        releaseId: 'legacy',
        title: 'Old',
        artist: '',
        year: '',
        media: [],
        ownershipStatus: [],
        availability: '',
      },
    ]
    expect(createPlaylistExportRows(source, [track('A')])).toEqual([])
  })

  it('uses fallback track order only when server entries are absent', () => {
    const source = playlist()
    source.serverEntries = undefined
    source.tracks = [track('B'), track('A'), track('B')].map(
      playlistTrackFromRecord,
    )
    expect(
      createPlaylistExportRows(source, [track('A'), track('B')]).map(
        (row) => row.trackId,
      ),
    ).toEqual(['B', 'A', 'B'])
  })

  it('offers every distinct recorded file without choosing one or mutating originals', () => {
    const first = file('one', '/demo/Music/a.flac')
    const second = file('two', '/demo/Music/a.mp3')
    const sameIdDifferentPath = file('one', '/demo/Music/moved.flac')
    const source = playlist()
    const tracks = [
      track('A', [
        first,
        { ...first, digitalTrackFileLinkId: 'other-link' },
        second,
        sameIdDifferentPath,
      ]),
      track('B'),
    ]
    const snapshot = structuredClone({ source, tracks })
    const rows = createPlaylistExportRows(source, tracks)
    expect(rows[0].files.map((item) => item.path)).toEqual([
      first.path,
      second.path,
      sameIdDifferentPath.path,
    ])
    expect(rows[0]).not.toHaveProperty('selectedFile')
    rows[0].files[0].path = '/demo/changed.flac'
    expect(rows[2].files[0].path).toBe(first.path)
    expect({ source, tracks }).toEqual(snapshot)
  })

  it('filters incomplete references but leaves real path validation to desktop preflight', () => {
    const malformed = file('unsafe', 'https://example.invalid/audio.flac')
    const rows = createPlaylistExportRows(playlist(), [
      track('A', [
        file('empty', ''),
        { ...file('id', '/demo/a.flac'), localAudioFileId: '' },
        { ...file('link', '/demo/b.flac'), digitalTrackFileLinkId: '' },
        malformed,
      ]),
    ])
    expect(rows[0].files).toEqual([malformed])
    expect(rows[1].files).toEqual([])
  })

  it('rejects legacy release entries rather than approximating a flattened selection', () => {
    const source = playlist()
    source.serverEntries = [{ kind: 'release', id: 'R' }]
    expect(() => createPlaylistExportRows(source, [])).toThrow(
      'track-only copy',
    )
    source.serverEntries = undefined
    source.linkedReleases = [
      {
        releaseId: 'R',
        title: 'Old',
        artist: '',
        year: '',
        media: [],
        ownershipStatus: [],
        availability: '',
      },
    ]
    expect(() => createPlaylistExportRows(source, [])).toThrow(
      'track-only copy',
    )
  })

  it('rejects Smart playlists without changing their rules or evaluated results', () => {
    const source: PlaylistRecord = {
      ...playlist(),
      type: 'Smart',
      smartRules: { summary: 'Ambient', criteria: ['Genre: Ambient'] },
      serverRules: {
        tags: [],
        genres: ['Ambient'],
        media: [],
        ownershipStatuses: [],
      },
    }
    const snapshot = structuredClone(source)
    expect(() => createPlaylistExportRows(source, [track('A')])).toThrow(
      'manual playlists only',
    )
    expect(source).toEqual(snapshot)
  })
})
