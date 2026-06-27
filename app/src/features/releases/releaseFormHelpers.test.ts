import { describe, expect, it } from 'vitest'
import type { TrackRecord } from '../tracks/tracksData'
import type { ReleaseRecord } from './releasesData'
import {
  releaseLabelNames,
  sortReleaseDetailTracks,
} from './releaseFormHelpers'

const release: ReleaseRecord = {
  id: 'two-disc-archive',
  title: 'Two Disc Archive',
  artist: 'Archive Artist',
  type: 'Album',
  year: '1994',
  label: 'Archive Label',
  genres: [],
  tags: [],
  releaseNotes: '',
  ownedCopies: [],
}

function releaseTrack({
  id,
  title,
  position,
  disc,
  side,
}: {
  id: string
  title: string
  position: string
  disc?: string
  side?: string
}): TrackRecord {
  return {
    id,
    title,
    artist: 'Archive Artist',
    release: {
      id: release.id,
      title: release.title,
      artist: release.artist,
      year: release.year,
      label: release.label,
    },
    trackNumber: position,
    disc,
    side,
    duration: '3:00',
    relationHint: '',
    tags: [],
    credits: [],
    releaseAppearances: [
      {
        releaseId: release.id,
        releaseTitle: release.title,
        releaseArtist: release.artist,
        year: release.year,
        label: release.label,
        position,
        disc,
        side,
        duration: '3:00',
      },
    ],
    relations: [],
    digitalFiles: [],
  }
}

describe('release form helpers', () => {
  it('deduplicates repeated label names while preserving catalog number rows elsewhere', () => {
    expect(
      releaseLabelNames({
        ...release,
        labels: [
          {
            labelId: 'big-life',
            name: 'Big Life',
            catalogNumber: 'BLRDCD 5',
            hasNoCatalogNumber: false,
          },
          {
            labelId: 'big-life',
            name: 'Big Life',
            catalogNumber: '847963. 2',
            hasNoCatalogNumber: false,
          },
        ],
      }),
    ).toEqual(['Big Life'])
  })

  it('groups release detail tracks by disc context when positions repeat', () => {
    const sortedTracks = sortReleaseDetailTracks(
      [
        releaseTrack({
          id: 'cd2-track-1',
          title: 'CD 2 Opener',
          position: '1',
          disc: 'CD 2',
        }),
        releaseTrack({
          id: 'cd1-track-2',
          title: 'CD 1 Second',
          position: '2',
          disc: 'CD 1',
        }),
        releaseTrack({
          id: 'cd1-track-1',
          title: 'CD 1 Opener',
          position: '1',
          disc: 'CD 1',
        }),
        releaseTrack({
          id: 'cd2-track-2',
          title: 'CD 2 Second',
          position: '2',
          disc: 'CD 2',
        }),
      ],
      release,
    )

    expect(sortedTracks.map((track) => track.title)).toEqual([
      'CD 1 Opener',
      'CD 1 Second',
      'CD 2 Opener',
      'CD 2 Second',
    ])
  })

  it('keeps global position order when release detail positions are unique', () => {
    const sortedTracks = sortReleaseDetailTracks(
      [
        releaseTrack({
          id: 'cd2-track-3',
          title: 'CD 2 Transition',
          position: '3',
          disc: 'CD 2',
        }),
        releaseTrack({
          id: 'cd1-track-4',
          title: 'CD 1 Closer',
          position: '4',
          disc: 'CD 1',
        }),
        releaseTrack({
          id: 'cd1-track-1',
          title: 'CD 1 Opener',
          position: '1',
          disc: 'CD 1',
        }),
      ],
      release,
    )

    expect(sortedTracks.map((track) => track.title)).toEqual([
      'CD 1 Opener',
      'CD 2 Transition',
      'CD 1 Closer',
    ])
  })

  it('orders repeated positions by side within the same disc', () => {
    const sortedTracks = sortReleaseDetailTracks(
      [
        releaseTrack({
          id: 'side-b-track-1',
          title: 'Side B Opener',
          position: '1',
          disc: 'Disc 1',
          side: 'B',
        }),
        releaseTrack({
          id: 'side-a-track-2',
          title: 'Side A Second',
          position: '2',
          disc: 'Disc 1',
          side: 'A',
        }),
        releaseTrack({
          id: 'side-a-track-1',
          title: 'Side A Opener',
          position: '1',
          disc: 'Disc 1',
          side: 'A',
        }),
        releaseTrack({
          id: 'side-b-track-2',
          title: 'Side B Second',
          position: '2',
          disc: 'Disc 1',
          side: 'B',
        }),
      ],
      release,
    )

    expect(sortedTracks.map((track) => track.title)).toEqual([
      'Side A Opener',
      'Side A Second',
      'Side B Opener',
      'Side B Second',
    ])
  })
})
