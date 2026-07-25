import { describe, expect, it } from 'vitest'
import type { LocalOriginalCandidateDto } from '../catalog/api/catalogDtoTypes'
import {
  buildOriginalCandidateStackCommand,
  confidenceLabel,
  evidenceGroups,
  findOriginalCandidate,
  initialOriginalCandidateRelationType,
} from './originalTrackDiscoveryModel'

const relationTypeOptions = [
  { code: 'remixOf', label: 'Remix of' },
  { code: 'versionOf', label: 'Version of' },
]

describe('original track discovery model', () => {
  it('maps confidence labels and keeps evidence in separate stable groups', () => {
    const candidate = candidateFixture({
      supportingEvidence: [{ code: 'identityMatch', channel: 'localCatalog' }],
      contradictions: [{ code: 'laterChronology', channel: 'discogs' }],
      missingEvidence: [{ code: 'missingDuration', channel: 'musicBrainz' }],
    })

    expect(confidenceLabel('high')).toBe('High confidence')
    expect(confidenceLabel('medium')).toBe('Medium confidence')
    expect(confidenceLabel('low')).toBe('Low confidence')
    expect(evidenceGroups(candidate)).toEqual([
      {
        key: 'supporting',
        label: 'Supporting evidence',
        items: candidate.supportingEvidence,
      },
      {
        key: 'contradictions',
        label: 'Contradictions',
        items: candidate.contradictions,
      },
      {
        key: 'missing',
        label: 'Missing evidence',
        items: candidate.missingEvidence,
      },
    ])
  })

  it('uses candidateKey for lookup and enables suggestions only when configured', () => {
    const candidate = candidateFixture({
      candidateKey: 'stable-candidate-key',
      localTrackId: 'local-track-id',
      suggestedRelationTypeCode: 'remixOf',
    })

    expect(findOriginalCandidate([candidate], 'stable-candidate-key')).toBe(
      candidate,
    )
    expect(findOriginalCandidate([candidate], 'local-track-id')).toBeNull()
    expect(
      initialOriginalCandidateRelationType(candidate, relationTypeOptions),
    ).toEqual(relationTypeOptions[0])
    expect(
      initialOriginalCandidateRelationType(candidate, [relationTypeOptions[1]]),
    ).toBeNull()
  })

  it('builds stack commands from localTrackId and rejects unavailable diagnostics', () => {
    const candidate = candidateFixture({
      candidateKey: 'provider:recording:key',
      localTrackId: 'catalog-track-id',
      requiresPromotion: true,
    })

    expect(
      buildOriginalCandidateStackCommand('source-track', candidate, 'remixOf'),
    ).toEqual({
      sourceTrackId: 'source-track',
      targetRootTrackId: 'catalog-track-id',
      relationTypeCode: 'remixOf',
      markTargetAsOriginal: true,
    })
    expect(
      buildOriginalCandidateStackCommand(
        'source-track',
        candidateFixture({ selectable: false, confidence: 'low' }),
        'remixOf',
      ),
    ).toBeNull()
    expect(
      buildOriginalCandidateStackCommand('source-track', null, 'remixOf'),
    ).toBeNull()
  })
})

function candidateFixture(
  overrides: Partial<LocalOriginalCandidateDto> = {},
): LocalOriginalCandidateDto {
  return {
    candidateKey: 'candidate-key',
    localTrackId: 'local-track',
    title: 'Pulse',
    artistDisplay: 'Candidate Artist',
    durationSeconds: 300,
    versionYear: 1982,
    origins: ['local'],
    confidence: 'high',
    selectable: true,
    isExistingRoot: true,
    memberCount: 1,
    requiresPromotion: false,
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
