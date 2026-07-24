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
  candidate: LocalOriginalCandidateDto,
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

export function findOriginalCandidate(
  candidates: readonly LocalOriginalCandidateDto[],
  candidateKey: string | null,
): LocalOriginalCandidateDto | null {
  if (candidateKey === null) {
    return null
  }

  return (
    candidates.find((candidate) => candidate.candidateKey === candidateKey) ??
    null
  )
}

export function initialOriginalCandidateRelationType(
  candidate: LocalOriginalCandidateDto,
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
): StackRelationCommand | null {
  if (!candidate?.selectable || !relationTypeCode) {
    return null
  }

  return buildStackRelationCommand(
    sourceTrackId,
    candidate.localTrackId,
    relationTypeCode,
    candidate.requiresPromotion,
  )
}
