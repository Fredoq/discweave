import { render } from '@testing-library/react'
import { createRef, useEffect, useState } from 'react'
import { vi } from 'vitest'
import type {
  ExternalOriginalCandidateListDto,
  LocalOriginalCandidateDto,
  LocalOriginalCandidateListDto,
} from '../catalog/api/catalogDtoTypes'
import type { StackRelationCommand } from '../catalog/api/ownedRelationsClient'
import { OriginalTrackDiscoveryDialog } from './OriginalTrackDiscoveryDialog'
import type { StackRelationTypeOption } from './trackStackModel'
import type { TrackRecord } from './tracksData'
import {
  useOriginalTrackDiscovery,
  type ExternalOriginalCandidateLoader,
  type OriginalCandidateConfirmation,
  type OriginalCandidateLoader,
  type OriginalTrackDiscoveryConfirmedResult,
} from './useOriginalTrackDiscovery'

export const defaultRelationTypeOptions: readonly StackRelationTypeOption[] = [
  { code: 'remixOf', label: 'Remix of' },
  { code: 'versionOf', label: 'Version of' },
]

type DiscoveryDialogOverrides = Readonly<{
  sourceTrack?: TrackRecord
  relationTypeOptions?: readonly StackRelationTypeOption[]
  loadCandidates?: OriginalCandidateLoader
  loadExternalCandidates?: ExternalOriginalCandidateLoader
  confirmStackRelation?: OriginalCandidateConfirmation
  onConfirmed?: (result: OriginalTrackDiscoveryConfirmedResult) => void
}>

export function renderDiscoveryDialog(
  overrides: DiscoveryDialogOverrides = {},
) {
  const sourceTrack = overrides.sourceTrack ?? sourceTrackFixture()
  const relationTypeOptions =
    overrides.relationTypeOptions ?? defaultRelationTypeOptions
  const loadCandidates =
    overrides.loadCandidates ??
    vi.fn<OriginalCandidateLoader>().mockResolvedValue(candidateResponse())
  const confirmStackRelation =
    overrides.confirmStackRelation ??
    vi
      .fn<(command: StackRelationCommand) => Promise<void>>()
      .mockResolvedValue(undefined)
  const onConfirmed = overrides.onConfirmed ?? vi.fn()
  const returnFocusRef = createRef<HTMLButtonElement>()
  let openSource: (nextSource: TrackRecord) => Promise<void> = () =>
    Promise.resolve()

  function Harness() {
    const [displaySource, setDisplaySource] = useState(sourceTrack)
    const controller = useOriginalTrackDiscovery({
      relationTypeOptions,
      loadCandidates,
      loadExternalCandidates: overrides.loadExternalCandidates,
      confirmStackRelation,
      onConfirmed,
    })
    const openDiscovery = controller.open
    openSource = async (nextSource: TrackRecord) => {
      setDisplaySource(nextSource)
      await openDiscovery(nextSource.id)
    }

    useEffect(() => {
      void openDiscovery(sourceTrack.id)
    }, [openDiscovery])

    return (
      <>
        <h2 id="track-detail-title" tabIndex={-1}>
          Track details
        </h2>
        <button ref={returnFocusRef} type="button">
          Find original...
        </button>
        <OriginalTrackDiscoveryDialog
          controller={controller}
          relationTypeOptions={relationTypeOptions}
          returnFocusRef={returnFocusRef}
          sourceTrack={displaySource}
        />
      </>
    )
  }

  const rendered = render(<Harness />)
  return {
    ...rendered,
    confirmStackRelation,
    findOriginalButton: rendered.getByRole('button', {
      name: 'Find original...',
    }),
    loadCandidates,
    loadExternalCandidates: overrides.loadExternalCandidates,
    onConfirmed,
    openSource,
    sourceTrack,
  }
}

export function sourceTrackFixture(
  overrides: Partial<TrackRecord> = {},
): TrackRecord {
  return {
    id: 'source-track',
    title: 'Source Mix',
    artist: 'Source Artist',
    release: {
      id: 'source-release',
      title: 'Source Release',
      artist: 'Source Artist',
      year: '2004',
      label: 'Local Label',
    },
    trackNumber: '2',
    duration: '4:12',
    relationHint: '',
    tags: [],
    credits: [],
    releaseAppearances: [],
    relations: [],
    digitalFiles: [],
    ...overrides,
  }
}

export function highCandidate(
  overrides: Partial<LocalOriginalCandidateDto> = {},
): LocalOriginalCandidateDto {
  return candidateFixture({
    candidateKey: 'high-candidate',
    localTrackId: 'high-track',
    title: 'Original Cut',
    confidence: 'high',
    isExistingRoot: true,
    memberCount: 2,
    requiresPromotion: false,
    suggestedRelationTypeCode: 'remixOf',
    supportingEvidence: [
      { code: 'knownLocalRoot', channel: 'localCatalog' },
      { code: 'earlierChronology', channel: 'localCatalog' },
    ],
    ...overrides,
  })
}

export function mediumCandidate(
  overrides: Partial<LocalOriginalCandidateDto> = {},
): LocalOriginalCandidateDto {
  return candidateFixture({
    candidateKey: 'medium-candidate',
    localTrackId: 'medium-track',
    title: 'Earlier Version',
    confidence: 'medium',
    isExistingRoot: false,
    memberCount: 0,
    requiresPromotion: true,
    suggestedRelationTypeCode: 'versionOf',
    earliestKnownDate: {
      value: '1982-05',
      precision: 'month',
      complete: false,
    },
    supportingEvidence: [{ code: 'identityMatch', channel: 'localCatalog' }],
    contradictions: [{ code: 'incompleteChronology', channel: 'localCatalog' }],
    ...overrides,
  })
}

export function lowCandidate(
  overrides: Partial<LocalOriginalCandidateDto> = {},
): LocalOriginalCandidateDto {
  return candidateFixture({
    candidateKey: 'low-candidate',
    localTrackId: 'low-track',
    title: 'Uncertain Local Match',
    confidence: 'low',
    selectable: false,
    isExistingRoot: false,
    memberCount: 0,
    requiresPromotion: false,
    suggestedRelationTypeCode: null,
    supportingEvidence: [],
    contradictions: [
      { code: 'incompatibleVersionMarker', channel: 'localCatalog' },
    ],
    missingEvidence: [
      { code: 'missingArtist', channel: 'localCatalog' },
      { code: 'missingDuration', channel: 'localCatalog' },
    ],
    ...overrides,
  })
}

export function candidateResponse(
  items: LocalOriginalCandidateDto[] = [
    highCandidate(),
    mediumCandidate(),
    lowCandidate(),
  ],
): LocalOriginalCandidateListDto {
  return {
    sourceTrackId: 'source-track',
    hasReliableLocalCandidate: items.some(
      (candidate) => candidate.confidence === 'high',
    ),
    items,
  }
}

export function externalCandidateResponse(
  overrides: Partial<ExternalCandidateResponseFixture> = {},
): ExternalCandidateResponseFixture {
  return {
    local: candidateResponse([mediumCandidate()]),
    items: [
      {
        candidateKey:
          'musicbrainz:recording:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        localTrackId: null,
        recordingSource: {
          providerCode: 'musicbrainz',
          resourceType: 'recording',
          externalId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          sourceUrl:
            'https://musicbrainz.org/recording/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          attribution: 'MusicBrainz',
        },
        title: 'MusicBrainz Original',
        artists: ['External Artist'],
        origins: ['musicbrainz'],
        confidence: 'high',
        selectable: true,
        suggestedRelationTypeCode: 'remixOf',
        earliestKnownDate: {
          value: '1981-02-03',
          precision: 'day',
          complete: true,
        },
        supportingEvidence: [
          { code: 'directedLineage', channel: 'musicBrainz' },
        ],
        contradictions: [],
        missingEvidence: [],
        releaseRoutes: [
          {
            releaseSource: {
              providerCode: 'musicbrainz',
              resourceType: 'release',
              externalId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              sourceUrl:
                'https://musicbrainz.org/release/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              attribution: 'MusicBrainz',
            },
            releaseGroupSource: {
              providerCode: 'musicbrainz',
              resourceType: 'release-group',
              externalId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              sourceUrl:
                'https://musicbrainz.org/release-group/cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              attribution: 'MusicBrainz',
            },
            title: 'First Release',
            date: { year: 1981, month: 2, day: 3 },
            mediumPosition: '1',
            musicBrainzTrackMbid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            releaseGroupRerecordingContext: false,
            relatedReleaseSources: [],
          },
        ],
      },
    ],
    providerStatuses: [
      {
        providerCode: 'musicbrainz',
        outcome: 'succeeded',
        errorCode: null,
        retryAfter: null,
      },
    ],
    warnings: [],
    ...overrides,
  }
}

export type ExternalCandidateResponseFixture = ExternalOriginalCandidateListDto

function candidateFixture(
  overrides: Partial<LocalOriginalCandidateDto> = {},
): LocalOriginalCandidateDto {
  return {
    candidateKey: 'candidate-key',
    localTrackId: 'local-track',
    title: 'Local Candidate',
    artistDisplay: 'Local Artist',
    durationSeconds: 248,
    versionYear: 1982,
    origins: ['local'],
    confidence: 'high',
    selectable: true,
    isExistingRoot: false,
    memberCount: 0,
    requiresPromotion: true,
    suggestedRelationTypeCode: 'remixOf',
    earliestKnownDate: {
      value: '1982',
      precision: 'year',
      complete: true,
    },
    supportingEvidence: [],
    contradictions: [],
    missingEvidence: [],
    ...overrides,
  }
}

export function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}
