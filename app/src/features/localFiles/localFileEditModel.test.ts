import { describe, expect, it } from 'vitest'
import { localEditableFileFromTrack } from './localFileEditModel'
import type { TrackRecord } from '../tracks/tracksData'

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
      versionHint: '',
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
      fileMetadata: {
        ownedItemId: 'owned-little-fluffy-clouds',
        format: 'FLAC',
        path: '/music/01 Little Fluffy Clouds.flac',
        bitrate: 'Lossless',
        sampleRate: '44.1 kHz / 16-bit',
        channels: 'Stereo',
        importedAt: 'Mock import',
        checksum: 'sha256:sample',
      },
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
      versionHint: '',
      relationHint: '',
      tags: ['Dance'],
      credits: [],
      releaseAppearances: [],
      relations: [],
      fileMetadata: {
        ownedItemId: 'owned-its-like-that-radio-edit',
        format: 'FLAC',
        path: '/music/01 Its Like That.flac',
        bitrate: 'Lossless',
        sampleRate: '44.1 kHz / 16-bit',
        channels: 'Stereo',
        importedAt: 'Mock import',
        checksum: 'sha256:sample',
      },
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
      versionHint: '',
      relationHint: '',
      genres: [],
      tags: [],
      credits: [],
      releaseAppearances: [],
      relations: [],
      fileMetadata: {
        ownedItemId: 'owned-its-like-that-radio-edit',
        format: 'FLAC',
        path: '/music/01 Its Like That.flac',
        bitrate: 'Lossless',
        sampleRate: '44.1 kHz / 16-bit',
        channels: 'Stereo',
        importedAt: 'Mock import',
        checksum: 'sha256:sample',
      },
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
      versionHint: '',
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
      fileMetadata: {
        ownedItemId: 'owned-track-main-artists',
        format: 'FLAC',
        path: '/music/track-main-artists.flac',
        bitrate: 'Lossless',
        sampleRate: '44.1 kHz / 16-bit',
        channels: 'Stereo',
        importedAt: 'Mock import',
        checksum: 'sha256:track-main-artists',
      },
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
      versionHint: '',
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
      fileMetadata: {
        ownedItemId: 'owned-track-with-producer-only',
        format: 'FLAC',
        path: '/music/track-with-producer-only.flac',
        bitrate: 'Lossless',
        sampleRate: '44.1 kHz / 16-bit',
        channels: 'Stereo',
        importedAt: 'Mock import',
        checksum: 'sha256:track-with-producer-only',
      },
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
      versionHint: '',
      relationHint: '',
      genres: ['Dance', 'Garage House'],
      tags: [],
      credits: [],
      releaseAppearances: [],
      relations: [],
      fileMetadata: {
        ownedItemId: 'owned-track-genre',
        format: 'FLAC',
        path: '/music/track-genre.flac',
        bitrate: 'Lossless',
        sampleRate: '44.1 kHz / 16-bit',
        channels: 'Stereo',
        importedAt: 'Mock import',
        checksum: 'sha256:track-genre',
      },
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
      versionHint: '',
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
      fileMetadata: {
        ownedItemId: 'owned-custom-role-track',
        format: 'FLAC',
        path: '/music/custom-role-track.flac',
        bitrate: 'Lossless',
        sampleRate: '44.1 kHz / 16-bit',
        channels: 'Stereo',
        importedAt: 'Mock import',
        checksum: 'sha256:custom',
      },
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
      versionHint: '',
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
      fileMetadata: {
        ownedItemId: 'owned-custom-tag-track',
        format: 'FLAC',
        path: '/music/custom-tag-track.flac',
        bitrate: 'Lossless',
        sampleRate: '44.1 kHz / 16-bit',
        channels: 'Stereo',
        importedAt: 'Mock import',
        checksum: 'sha256:custom-tag',
      },
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
      versionHint: '',
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
      fileMetadata: {
        ownedItemId: 'owned-featured-remixer-tag-track',
        format: 'FLAC',
        path: '/music/featured-remixer-tag-track.flac',
        bitrate: 'Lossless',
        sampleRate: '44.1 kHz / 16-bit',
        channels: 'Stereo',
        importedAt: 'Mock import',
        checksum: 'sha256:featured-remixer-tag-track',
      },
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
})
