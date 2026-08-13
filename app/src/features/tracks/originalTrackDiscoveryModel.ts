import type {
  LocalOriginalCandidateDto,
  OriginalCandidateConfidence,
  OriginalCandidateEvidenceDto,
} from '../catalog/api/catalogDtoTypes'
import type { StackRelationCommand } from '../catalog/api/ownedRelationsClient'
import {
  buildStackRelationCommand,
  type StackRelationTypeOption,
} from './trackStackModel'
import type { OriginalTrackDiscoveryCandidate } from './originalTrackDiscoveryPresentation'

export type OriginalCandidateEvidenceGroup = Readonly<{
  key: 'supporting' | 'contradictions' | 'missing'
  label: string
  items: readonly OriginalCandidateEvidenceDto[]
}>

export function confidenceLabel(
  confidence: OriginalCandidateConfidence,
): string {
  switch (confidence) {
    case 'high':
      return 'High confidence'
    case 'medium':
      return 'Medium confidence'
    case 'low':
      return 'Low confidence'
  }
}

export function evidenceGroups(
  candidate: Pick<
    OriginalTrackDiscoveryCandidate,
    'supportingEvidence' | 'contradictions' | 'missingEvidence'
  >,
): OriginalCandidateEvidenceGroup[] {
  return [
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
  ]
}

export function findOriginalCandidate<
  Candidate extends Readonly<{ candidateKey: string }>,
>(
  candidates: readonly Candidate[],
  candidateKey: string | null,
): Candidate | null {
  if (candidateKey === null) {
    return null
  }

  return (
    candidates.find((candidate) => candidate.candidateKey === candidateKey) ??
    null
  )
}

export function initialOriginalCandidateRelationType(
  candidate: Pick<OriginalTrackDiscoveryCandidate, 'suggestedRelationTypeCode'>,
  relationTypeOptions: readonly StackRelationTypeOption[],
): StackRelationTypeOption | null {
  if (candidate.suggestedRelationTypeCode === null) {
    return null
  }

  return (
    relationTypeOptions.find(
      (option) => option.code === candidate.suggestedRelationTypeCode,
    ) ?? null
  )
}

export function buildOriginalCandidateStackCommand(
  sourceTrackId: string,
  candidate: LocalOriginalCandidateDto | null,
  relationTypeCode: string | null,
  allowLowConfidence = false,
): StackRelationCommand | null {
  const candidateCanBeReviewed =
    candidate?.selectable === true ||
    (candidate?.confidence === 'low' && allowLowConfidence)
  if (!candidateCanBeReviewed || !relationTypeCode) {
    return null
  }

  return buildStackRelationCommand(
    sourceTrackId,
    candidate.localTrackId,
    relationTypeCode,
    candidate.requiresPromotion,
  )
}
