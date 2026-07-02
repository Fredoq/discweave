import { describe, expect, it, vi } from 'vitest'
import type { TrackDigitalFile, TrackRecord } from '../tracks/tracksData'
import {
  isLocalFileOpenAvailable,
  openLocalFile,
  openableFilesFromReleaseTracks,
  openableFilesFromStackTracks,
  openableFilesFromTrack,
} from './localFileOpenModel'

describe('localFileOpenModel', () => {
  it('derives openable files from a track and skips incomplete file links', () => {
    const track = trackWithFiles([
      digitalFile(
        'link-a',
        'local-a',
        '/music/a.flac',
        'Selected Release',
        'A1',
      ),
      digitalFile(
        'link-empty-path',
        'local-empty-path',
        '   ',
        'Selected Release',
        'A2',
      ),
      digitalFile(
        'link-empty-id',
        '   ',
        '/music/no-id.flac',
        'Selected Release',
        'A3',
      ),
    ])

    expect(openableFilesFromTrack(track)).toEqual([
      expect.objectContaining({
        id: 'link-a',
        localAudioFileId: 'local-a',
        path: '/music/a.flac',
        trackId: 'track-a',
        trackTitle: 'Track A',
        releaseTitle: 'Selected Release',
        position: 'Track A1',
        format: 'FLAC',
      }),
    ])
  })

  it('de-duplicates by local audio file id before path', () => {
    const track = trackWithFiles([
      digitalFile(
        'link-a',
        'local-a',
        '/music/a.flac',
        'Selected Release',
        'A1',
      ),
      digitalFile(
        'link-b',
        'local-a',
        '/music/copy.flac',
        'Other Release',
        'B1',
      ),
      digitalFile(
        'link-c',
        'local-c',
        '/music/a.flac',
        'Path Duplicate Release',
        'C1',
      ),
    ])

    expect(openableFilesFromTrack(track).map((file) => file.id)).toEqual([
      'link-a',
      'link-c',
    ])
  })

  it('filters release files by release id', () => {
    const selectedTrack = trackWithFiles([
      digitalFile(
        'link-selected',
        'local-selected',
        '/music/selected.flac',
        'Selected Release',
        '3',
        'selected-release',
      ),
      digitalFile(
        'link-other',
        'local-other',
        '/music/other.flac',
        'Other Release',
        '7',
        'other-release',
      ),
    ])

    expect(
      openableFilesFromReleaseTracks([selectedTrack], 'selected-release').map(
        (file) => file.path,
      ),
    ).toEqual(['/music/selected.flac'])
  })

  it('keeps stack order from original track to members', () => {
    const original = {
      ...trackWithFiles([
        digitalFile(
          'link-original',
          'local-original',
          '/music/original.flac',
          'Original Release',
          '1',
        ),
      ]),
      id: 'original-track',
      title: 'Original Track',
    }
    const member = {
      ...trackWithFiles([
        digitalFile(
          'link-member',
          'local-member',
          '/music/member.flac',
          'Member Release',
          '2',
        ),
      ]),
      id: 'member-track',
      title: 'Member Track',
    }

    expect(
      openableFilesFromStackTracks([original, member]).map(
        (file) => file.trackTitle,
      ),
    ).toEqual(['Original Track', 'Member Track'])
  })

  it('detects desktop local file open availability', () => {
    const originalDesktopBridge = window.discweaveDesktop
    window.discweaveDesktop = undefined
    expect(isLocalFileOpenAvailable()).toBe(false)

    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: vi.fn() },
      imports: { pickAndScan: vi.fn() },
      localFiles: { open: vi.fn() },
    }
    expect(isLocalFileOpenAvailable()).toBe(true)

    window.discweaveDesktop = originalDesktopBridge
  })

  it('sends catalog file identity with the path when opening a local file', async () => {
    const originalDesktopBridge = window.discweaveDesktop
    const open = vi.fn().mockResolvedValue({ ok: true, path: '/music/a.flac' })
    window.discweaveDesktop = {
      isDesktop: true,
      exports: { download: vi.fn() },
      imports: { pickAndScan: vi.fn() },
      localFiles: { open },
    }

    const file = openableFilesFromTrack(
      trackWithFiles([
        digitalFile(
          'link-a',
          'local-a',
          '/music/a.flac',
          'Selected Release',
          'A1',
        ),
      ]),
    )[0]
    await expect(openLocalFile(file)).resolves.toEqual({
      ok: true,
      path: '/music/a.flac',
    })

    expect(open).toHaveBeenCalledWith({
      localAudioFileId: 'local-a',
      path: '/music/a.flac',
    })
    window.discweaveDesktop = originalDesktopBridge
  })
})

function trackWithFiles(digitalFiles: TrackDigitalFile[]): TrackRecord {
  return {
    id: 'track-a',
    title: 'Track A',
    artist: 'Archive Artist',
    release: {
      id: 'selected-release',
      title: 'Selected Release',
      artist: 'Archive Artist',
      year: '1992',
      label: 'Archive Label',
    },
    trackNumber: '1',
    duration: '4:00',
    relationHint: '',
    tags: [],
    credits: [],
    releaseAppearances: [],
    relations: [],
    digitalFiles,
  }
}

function digitalFile(
  digitalTrackFileLinkId: string,
  localAudioFileId: string,
  path: string,
  releaseTitle: string,
  position: string,
  releaseId = 'selected-release',
): TrackDigitalFile {
  return {
    digitalTrackFileLinkId,
    localAudioFileId,
    digitalOwnedItemId: `${digitalTrackFileLinkId}-owned`,
    releaseId,
    releaseTitle,
    releaseTrackId: `${digitalTrackFileLinkId}-release-track`,
    position,
    path,
    format: 'FLAC',
    codec: 'FLAC',
    quality: 'Lossless',
    contentHash: `sha256:${digitalTrackFileLinkId}`,
    duration: '4:00',
    bitrate: 'Lossless',
    sampleRate: '44.1 kHz / 16-bit',
    channels: 'Stereo',
  }
}
