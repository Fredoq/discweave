import { describe, expect, it } from 'vitest'
import {
  defaultCatalogDictionaries,
  type TrackStackDto,
} from '../catalog/catalogApi'
import * as h from '../../test/appTestHarness'
import { TrackStacksPanel } from './TrackStacksPanel'
import type { TrackDigitalFile, TrackRecord } from './tracksData'

h.setupAppTestHooks()

describe('TrackStacksPanel layout', () => {
  it('keeps action columns aligned when only some stack tracks have files', () => {
    const original = trackRecord('track-original', 'Original Mix', [])
    const memberWithFile = trackRecord('track-file', 'File Mix', [
      digitalFile('track-file'),
    ])
    const memberWithoutFile = trackRecord('track-no-file', 'No File Mix', [])
    const tracks = [original, memberWithFile, memberWithoutFile]
    const serverStacks: TrackStackDto[] = [
      {
        originalTrackId: original.id,
        originalTitle: original.title,
        originalVersionYear: 1998,
        memberCount: 2,
        hasCycleIssue: false,
        members: [
          {
            trackId: memberWithFile.id,
            title: memberWithFile.title,
            versionYear: 1998,
            relationType: 'remixOf',
            depth: 1,
            isDirect: true,
          },
          {
            trackId: memberWithoutFile.id,
            title: memberWithoutFile.title,
            versionYear: 1998,
            relationType: 'versionOf',
            depth: 1,
            isDirect: true,
          },
        ],
        issues: [],
      },
    ]

    h.render(
      <TrackStacksPanel
        dictionaries={defaultCatalogDictionaries}
        expandedStackIds={new Set([original.id])}
        ratingCriteria={[]}
        relations={[]}
        selectedTrackId=""
        serverStacks={serverStacks}
        stackRelationTypeCodes={['remixOf', 'versionOf']}
        tracks={tracks}
        visibleTracks={tracks}
        onCreateStackRelation={async () => {}}
        onOpenStackLocalFiles={() => {}}
        onOpenTrackLocalFiles={() => {}}
        onSelectTrack={() => {}}
        onToggleStack={() => {}}
      />,
    )

    const stackOpenFiles = h.screen.getByRole('button', {
      name: `Open stack files for ${original.title}`,
    })
    const rootActions = stackOpenFiles.closest('.track-stack-actions')
    expect(rootActions?.children).toHaveLength(2)
    expect(rootActions?.children[0]).toHaveClass(
      'track-stack-action-placeholder',
    )
    expect(rootActions?.children[1]).toBe(stackOpenFiles)

    const memberWithoutFileButton = h.screen.getByRole('button', {
      name: /No File Mix/,
    })
    expect(
      memberWithoutFileButton
        .closest('.track-stack-member-row')
        ?.querySelector('.track-stack-member-action-placeholder'),
    ).toBeInTheDocument()
  })
})

function trackRecord(
  id: string,
  title: string,
  digitalFiles: TrackDigitalFile[],
): TrackRecord {
  return {
    id,
    title,
    artist: 'Test Artist',
    release: {
      id: 'test-release',
      title: 'Test Release',
      artist: 'Test Artist',
      year: '1998',
      label: 'Test Label',
    },
    trackNumber: '1',
    duration: '3:46',
    versionYear: '1998',
    relationHint: '',
    tags: [],
    credits: [],
    releaseAppearances: [
      {
        releaseId: 'test-release',
        releaseTitle: 'Test Release',
        releaseArtist: 'Test Artist',
        year: '1998',
        label: 'Test Label',
        position: '1',
        duration: '3:46',
      },
    ],
    relations: [],
    digitalFiles,
  }
}

function digitalFile(trackId: string): TrackDigitalFile {
  return {
    digitalTrackFileLinkId: `link-${trackId}`,
    localAudioFileId: `local-${trackId}`,
    digitalOwnedItemId: `owned-${trackId}`,
    releaseId: 'test-release',
    releaseTitle: 'Test Release',
    releaseTrackId: `release-${trackId}`,
    position: '1',
    path: `/tmp/${trackId}.flac`,
    format: 'FLAC',
    codec: 'FLAC',
    quality: 'Lossless',
    contentHash: `sha256:${trackId}`,
    duration: '3:46',
    bitrate: '900 kbps',
    sampleRate: '44.1 kHz',
    channels: '2',
  }
}
