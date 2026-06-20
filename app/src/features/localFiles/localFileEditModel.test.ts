import { describe, expect, it } from 'vitest'
import {
  localEditableFileFromTrack,
  localEditableFileFromTrackDigitalFile,
} from './localFileEditModel'
import type { TrackDigitalFile, TrackRecord } from '../tracks/tracksData'

describe('localFileEditModel', () => {
  it('maps track artist roles to configured tag fields', () => {
    const track: TrackRecord = {
      id: 'little-fluffy-clouds',
      title: 'Little Fluffy Clouds',
      artist: 'The Orb',
      release: {
        id: 'ultraworld',
        title: "The Orb's Adventures Beyond the Ultraworld",
        artist: 'The Orb',
        year: '1991',
        releaseDate: '1991-04-15',
        label: 'Big Life BLRDCD 05',
        catalogNumber: 'BLRDCD 05',
      },
      trackNumber: '1',
      duration: '4:27',
      relationHint: '',
      tags: ['Electronica'],
      credits: [
        {
          role: 'Main artist',
          artist: 'The Orb',
          scope: 'Track credit.',
        },
        {
          role: 'Producer',
          artist: 'Youth',
          scope: 'Track credit.',
        },
      ],
      releaseAppearances: [],
      relations: [],
      digitalFiles: [
        editableDigitalFile(
          'local-little-fluffy-clouds',
          '/music/01 Little Fluffy Clouds.flac',
          'sha256:sample',
        ),
      ],
    }

    const editableFile = localEditableFileFromTrack(
      track,
      [
        {
          id: 'mapping-producer',
          creditRoleCode: 'producer',
          tagField: 'producer',
          sortOrder: 40,
          isActive: true,
          isBuiltin: true,
        },
      ],
      new Map([['producer', 'Producer']]),
    )

    expect(editableFile?.tags.producer).toEqual(['Youth'])
    expect(editableFile?.tags.date).toBe('1991-04-15')
    expect(editableFile?.tags.label).toBe('Big Life')
    expect(editableFile?.tags.catalogNumber).toBe('BLRDCD 05')
  })

  it('uses the first structured release label for file tags', () => {
    const track: TrackRecord = {
      id: 'its-like-that-radio-edit',
      title: "It's Like That (Drop the Break) (Radio Edit)",
      artist: 'Run-DMC, Jason Nevins',
      release: {
        id: 'its-like-that',
        title: "It's Like That",
        artist: 'Run-DMC, Jason Nevins',
        year: '1997',
        label: 'PIAS Benelux 456.9065.22, Sm:)e Communications SM-9065-2',
        labels: [
          {
            name: 'PIAS Benelux',
            catalogNumber: '456.9065.22',
            hasNoCatalogNumber: false,
          },
          {
            name: 'Sm:)e Communications',
            catalogNumber: 'SM-9065-2',
            hasNoCatalogNumber: false,
          },
        ],
        catalogNumber: '456.9065.22',
      },
      trackNumber: '1',
      duration: '4:27',
      relationHint: '',
      tags: ['Dance'],
      credits: [],
      releaseAppearances: [],
      relations: [],
      digitalFiles: [
        editableDigitalFile(
          'local-its-like-that-radio-edit',
          '/music/01 Its Like That.flac',
          'sha256:sample',
        ),
      ],
    }

    const editableFile = localEditableFileFromTrack(track)

    expect(editableFile?.release.label).toBe('PIAS Benelux')
    expect(editableFile?.tags.label).toBe('PIAS Benelux')
    expect(editableFile?.tags.catalogNumber).toBe('456.9065.22')
  })

  it('falls back to release genres when track genres are empty', () => {
    const track: TrackRecord = {
      id: 'its-like-that-radio-edit',
      title: "It's Like That (Drop the Break) (Radio Edit)",
      artist: 'Run-DMC, Jason Nevins',
      release: {
        id: 'its-like-that',
        title: "It's Like That",
        artist: 'Run-DMC, Jason Nevins',
        year: '1997',
        label: 'PIAS Benelux 456.9065.22',
        catalogNumber: '456.9065.22',
        genres: ['Electronic'],
      },
      trackNumber: '1',
      duration: '4:27',
      relationHint: '',
      genres: [],
      tags: [],
      credits: [],
      releaseAppearances: [],
      relations: [],
      digitalFiles: [
        editableDigitalFile(
          'local-its-like-that-radio-edit',
          '/music/01 Its Like That.flac',
          'sha256:sample',
        ),
      ],
    }

    const editableFile = localEditableFileFromTrack(track)

    expect(editableFile?.tags.genre).toEqual(['Electronic'])
  })

  it('uses track main artists for artist tags and release artists for album artist tags', () => {
    const track: TrackRecord = {
      id: 'track-main-artists',
      title: 'Track Main Artists',
      artist: 'Track Artist A, Track Artist B',
      release: {
        title: 'Archive Release',
        artist: 'Release Artist A, Release Artist B',
        year: '2026',
        label: 'Archive Label',
      },
      trackNumber: '1',
      duration: '',
      relationHint: '',
      tags: [],
      credits: [
        {
          role: 'Main artist',
          artist: 'Track Artist A',
          scope: 'Track credit.',
        },
        {
          role: 'Main artist',
          artist: 'Track Artist B',
          scope: 'Track credit.',
        },
      ],
      releaseAppearances: [],
      relations: [],
      digitalFiles: [
        editableDigitalFile(
          'local-track-main-artists',
          '/music/track-main-artists.flac',
          'sha256:track-main-artists',
        ),
      ],
    }

    const editableFile = localEditableFileFromTrack(track)

    expect(editableFile?.tags.artists).toEqual([
      'Track Artist A',
      'Track Artist B',
    ])
    expect(editableFile?.tags.albumArtists).toEqual([
      'Release Artist A',
      'Release Artist B',
    ])
  })

  it('falls back to release artists when a track has no main artist credit', () => {
    const track: TrackRecord = {
      id: 'track-with-producer-only',
      title: 'Track With Producer Only',
      artist: 'Producer Artist',
      release: {
        title: 'Archive Release',
        artist: 'Release Artist',
        year: '2026',
        label: 'Archive Label',
      },
      trackNumber: '1',
      duration: '',
      relationHint: '',
      tags: [],
      credits: [
        {
          role: 'Producer',
          artist: 'Producer Artist',
          scope: 'Track credit.',
        },
      ],
      releaseAppearances: [],
      relations: [],
      digitalFiles: [
        editableDigitalFile(
          'local-track-with-producer-only',
          '/music/track-with-producer-only.flac',
          'sha256:track-with-producer-only',
        ),
      ],
    }

    const editableFile = localEditableFileFromTrack(track)

    expect(editableFile?.tags.artists).toEqual(['Release Artist'])
    expect(editableFile?.tags.albumArtists).toEqual(['Release Artist'])
  })

  it('uses only the first track genre when filling file tags', () => {
    const track: TrackRecord = {
      id: 'track-genre',
      title: 'Track Genre',
      artist: 'Archive Artist',
      release: {
        title: 'Archive Release',
        artist: 'Archive Artist',
        year: '2026',
        label: 'Archive Label',
        genres: ['Electronic'],
      },
      trackNumber: '1',
      duration: '',
      relationHint: '',
      genres: ['Dance', 'Garage House'],
      tags: [],
      credits: [],
      releaseAppearances: [],
      relations: [],
      digitalFiles: [
        editableDigitalFile(
          'local-track-genre',
          '/music/track-genre.flac',
          'sha256:track-genre',
        ),
      ],
    }

    const editableFile = localEditableFileFromTrack(track)

    expect(editableFile?.tags.genre).toEqual(['Dance'])
  })

  it('matches role mappings by dictionary label when role names are customized', () => {
    const track: TrackRecord = {
      id: 'custom-role-track',
      title: 'Custom Role Track',
      artist: 'Archive Artist',
      release: {
        title: 'Archive Release',
        artist: 'Archive Artist',
        year: '2026',
        label: 'Archive Label',
      },
      trackNumber: '1',
      duration: '',
      relationHint: '',
      tags: [],
      credits: [
        {
          role: 'Production',
          artist: 'Mapped Producer',
          scope: 'Track credit.',
        },
      ],
      releaseAppearances: [],
      relations: [],
      digitalFiles: [
        editableDigitalFile(
          'local-custom-role-track',
          '/music/custom-role-track.flac',
          'sha256:custom',
        ),
      ],
    }

    const editableFile = localEditableFileFromTrack(
      track,
      [
        {
          id: 'mapping-producer',
          creditRoleCode: 'producer',
          tagField: 'producer',
          sortOrder: 40,
          isActive: true,
          isBuiltin: true,
        },
      ],
      new Map([['producer', 'Production']]),
    )

    expect(editableFile?.tags.producer).toEqual(['Mapped Producer'])
  })

  it('keeps custom tag fields from role mappings', () => {
    const track: TrackRecord = {
      id: 'custom-tag-track',
      title: 'Custom Tag Track',
      artist: 'Archive Artist',
      release: {
        title: 'Archive Release',
        artist: 'Archive Artist',
        year: '2026',
        label: 'Archive Label',
      },
      trackNumber: '1',
      duration: '',
      relationHint: '',
      tags: [],
      credits: [
        {
          role: 'DJ Mixer',
          artist: 'Custom Mapper',
          scope: 'Track credit.',
        },
      ],
      releaseAppearances: [],
      relations: [],
      digitalFiles: [
        editableDigitalFile(
          'local-custom-tag-track',
          '/music/custom-tag-track.flac',
          'sha256:custom-tag',
        ),
      ],
    }

    const editableFile = localEditableFileFromTrack(
      track,
      [
        {
          id: 'mapping-dj-mixer',
          creditRoleCode: 'djMixer',
          tagField: 'DJMIXER',
          sortOrder: 90,
          isActive: true,
          isBuiltin: false,
        },
      ],
      new Map([['djMixer', 'DJ Mixer']]),
    )

    expect(editableFile?.tags.DJMIXER).toEqual(['Custom Mapper'])
  })

  it('allows any configured role to fill the standard remixer tag field', () => {
    const track: TrackRecord = {
      id: 'featured-remixer-tag-track',
      title: 'Featured Remixer Tag Track',
      artist: 'Archive Artist',
      release: {
        title: 'Archive Release',
        artist: 'Archive Artist',
        year: '2026',
        label: 'Archive Label',
      },
      trackNumber: '1',
      duration: '',
      relationHint: '',
      tags: [],
      credits: [
        {
          role: 'Featured Artist',
          artist: 'Featured Mapper',
          scope: 'Track credit.',
        },
      ],
      releaseAppearances: [],
      relations: [],
      digitalFiles: [
        editableDigitalFile(
          'local-featured-remixer-tag-track',
          '/music/featured-remixer-tag-track.flac',
          'sha256:featured-remixer-tag-track',
        ),
      ],
    }

    const editableFile = localEditableFileFromTrack(
      track,
      [
        {
          id: 'mapping-featured-to-remixer',
          creditRoleCode: 'featuredArtist',
          tagField: 'remixer',
          sortOrder: 100,
          isActive: true,
          isBuiltin: false,
        },
      ],
      new Map([['featuredArtist', 'Featured Artist']]),
    )

    expect(editableFile?.tags.remixer).toEqual(['Featured Mapper'])
  })

  it('maps the selected track digital file into a local editable file', () => {
    const firstFile = editableDigitalFile(
      'local-first-file',
      '/music/first.flac',
      'sha256:first',
    )
    const selectedFile = {
      ...editableDigitalFile(
        'local-selected-file',
        '/music/selected.flac',
        'sha256:selected',
      ),
      releaseId: 'selected-release',
      releaseTitle: 'Selected Release',
      position: '7',
    }
    const track: TrackRecord = {
      id: 'multi-file-track',
      title: 'Multi File Track',
      artist: 'Archive Artist',
      release: {
        title: 'Archive Release',
        artist: 'Archive Artist',
        year: '2026',
        label: 'Archive Label',
      },
      trackNumber: '1',
      duration: '',
      relationHint: '',
      tags: [],
      credits: [],
      releaseAppearances: [],
      relations: [],
      digitalFiles: [firstFile, selectedFile],
    }

    const editableFile = localEditableFileFromTrackDigitalFile(
      track,
      selectedFile,
    )

    expect(editableFile?.localAudioFileId).toBe('local-selected-file')
    expect(editableFile?.currentPath).toBe('/music/selected.flac')
    expect(editableFile?.targetPath).toBe('/music/selected.flac')
    expect(editableFile?.position).toBe('7')
    expect(editableFile?.release.title).toBe('Selected Release')
  })

  it('uses selected digital file release metadata for local tag targets', () => {
    const selectedFile = {
      ...editableDigitalFile(
        'local-selected-release-file',
        '/music/selected-release.flac',
        'sha256:selected-release',
      ),
      releaseId: 'selected-release',
      releaseTitle: 'Selected Release',
      releaseArtist: 'Selected Artist',
      releaseYear: '2001',
      releaseDate: '2001-02-03',
      releaseLabel: 'Selected Label',
      releaseCatalogNumber: 'SEL-001',
      position: '4',
    } as TrackDigitalFile
    const track: TrackRecord = {
      id: 'context-track',
      title: 'Context Track',
      artist: 'Canonical Artist',
      release: {
        id: 'canonical-release',
        title: 'Canonical Release',
        artist: 'Canonical Artist',
        year: '1999',
        releaseDate: '1999-01-01',
        label: 'Canonical Label',
        catalogNumber: 'CAN-001',
      },
      trackNumber: '1',
      duration: '',
      relationHint: '',
      tags: [],
      credits: [],
      releaseAppearances: [],
      relations: [],
      digitalFiles: [selectedFile],
    }

    const editableFile = localEditableFileFromTrackDigitalFile(
      track,
      selectedFile,
    )

    expect(editableFile?.release).toMatchObject({
      title: 'Selected Release',
      artists: 'Selected Artist',
      year: '2001',
      releaseDate: '2001-02-03',
      label: 'Selected Label',
      catalogNumber: 'SEL-001',
    })
    expect(editableFile?.tags).toMatchObject({
      album: 'Selected Release',
      albumArtists: ['Selected Artist'],
      trackNumber: 4,
      date: '2001-02-03',
      year: 2001,
      label: 'Selected Label',
      catalogNumber: 'SEL-001',
    })
  })
})

function editableDigitalFile(
  localAudioFileId: string,
  path: string,
  contentHash: string,
) {
  return {
    digitalTrackFileLinkId: `${localAudioFileId}-link`,
    localAudioFileId,
    digitalOwnedItemId: `${localAudioFileId}-owned-item`,
    releaseId: 'release-id',
    releaseTitle: 'Release title',
    releaseTrackId: `${localAudioFileId}-release-track`,
    position: '1',
    path,
    format: 'FLAC',
    codec: 'FLAC',
    quality: 'Lossless',
    contentHash,
    duration: 'Not recorded',
    bitrate: 'Lossless',
    sampleRate: '44.1 kHz / 16-bit',
    channels: 'Stereo',
  }
}
