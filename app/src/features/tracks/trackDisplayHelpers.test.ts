import { describe, expect, it } from 'vitest'
import {
  isDifferentTrackDigitalFilePath,
  isReusedTrackDigitalFile,
  trackDigitalFilePositionLabel,
  trackDigitalFileSummary,
} from './trackDisplayHelpers'
import type { TrackDigitalFile, TrackRecord } from './tracksData'

describe('trackDisplayHelpers digital file context', () => {
  it('summarizes linked rows, unique local files, reused files and paths', () => {
    const track = trackWithDigitalFiles([
      file({ localAudioFileId: 'local-shared', path: '/music/a.flac' }),
      file({
        digitalTrackFileLinkId: 'link-shared-second-copy',
        localAudioFileId: 'local-shared',
        releaseId: 'release-2',
        releaseTitle: 'Classics',
        releaseTrackId: 'release-track-2',
        position: '9',
        path: '/music/a.flac',
      }),
      file({
        digitalTrackFileLinkId: 'link-different-path',
        localAudioFileId: 'local-different',
        releaseId: 'release-3',
        releaseTitle: 'Reissue',
        releaseTrackId: 'release-track-3',
        position: 'D1',
        path: '/music/reissue/a.flac',
      }),
    ])

    expect(trackDigitalFileSummary(track)).toEqual({
      linkedFileRows: 3,
      uniqueLocalFiles: 2,
      reusedLocalFiles: 1,
      distinctPaths: 2,
      hasReusedLocalFiles: true,
      hasDifferentPaths: true,
    })
  })

  it('identifies reused local files and different paths per row', () => {
    const shared = file({
      localAudioFileId: 'local-shared',
      path: '/music/a.flac',
    })
    const sharedAgain = file({
      digitalTrackFileLinkId: 'link-shared-again',
      localAudioFileId: 'local-shared',
      releaseId: 'release-2',
      releaseTitle: 'Classics',
      releaseTrackId: 'release-track-2',
      position: '9',
      path: '/music/a.flac',
    })
    const different = file({
      digitalTrackFileLinkId: 'link-different',
      localAudioFileId: 'local-different',
      releaseId: 'release-3',
      releaseTitle: 'Reissue',
      releaseTrackId: 'release-track-3',
      position: 'D1',
      path: '/music/reissue/a.flac',
    })
    const files = [shared, sharedAgain, different]

    expect(isReusedTrackDigitalFile(shared, files)).toBe(true)
    expect(isReusedTrackDigitalFile(different, files)).toBe(false)
    expect(isDifferentTrackDigitalFilePath(shared, files)).toBe(true)
    expect(isDifferentTrackDigitalFilePath(different, files)).toBe(true)
  })

  it('formats release track position with disc and side context', () => {
    expect(
      trackDigitalFilePositionLabel(
        file({ disc: 'Disc 2', side: 'B', position: '4' }),
      ),
    ).toBe('Disc 2 · Side B · Track 4')
    expect(trackDigitalFilePositionLabel(file({ position: '3' }))).toBe(
      'Track 3',
    )
  })
})

function trackWithDigitalFiles(digitalFiles: TrackDigitalFile[]): TrackRecord {
  return {
    id: 'track-a',
    title: 'Track A',
    artist: 'Artist A',
    release: {
      id: 'release-1',
      title: 'Release A',
      artist: 'Artist A',
      year: '1992',
      label: 'Label A',
    },
    trackNumber: '1',
    duration: '4:44',
    relationHint: '',
    tags: [],
    credits: [],
    releaseAppearances: [],
    relations: [],
    digitalFiles,
  }
}

function file(overrides: Partial<TrackDigitalFile> = {}): TrackDigitalFile {
  return {
    digitalTrackFileLinkId: 'link-1',
    localAudioFileId: 'local-1',
    digitalOwnedItemId: 'owned-1',
    releaseId: 'release-1',
    releaseTitle: 'Release A',
    releaseTrackId: 'release-track-1',
    position: '1',
    path: '/music/a.flac',
    format: 'FLAC',
    codec: 'FLAC',
    quality: 'Lossless',
    contentHash: 'sha256:a',
    duration: '4:44',
    bitrate: 'Lossless',
    sampleRate: '44.1 kHz / 16-bit',
    channels: 'Stereo',
    ...overrides,
  }
}
