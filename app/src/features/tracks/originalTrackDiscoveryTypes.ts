import type {
  ExternalOriginalCandidateDto,
  ExternalOriginalCandidateListDto,
  ExternalProviderOperationStatusDto,
  ExternalProviderSearchDiagnosticDto,
  ExternalReleaseDraftRequestDto,
  LocalOriginalCandidateDto,
  LocalOriginalCandidateListDto,
} from '../catalog/api/catalogDtoTypes'
import type { ReleaseImportSession } from '../catalog/api/catalogImportTypes'
import type {
  FindExternalOriginalCandidatesOptions,
  ListLocalOriginalCandidatesOptions,
} from '../catalog/api/originalTrackDiscoveryClient'
import type { StackRelationCommand } from '../catalog/api/ownedRelationsClient'
import type { StackRelationTypeOption } from './trackStackModel'
import type { OriginalTrackDiscoveryCandidate } from './originalTrackDiscoveryPresentation'

export type OriginalTrackDiscoveryStatus =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'empty'
  | 'source-not-found'
  | 'source-not-eligible'
  | 'retryable-error'

export type OriginalTrackDiscoveryStep = 'candidates' | 'review'
export type ExternalDiscoveryStatus = 'idle' | 'loading' | 'loaded' | 'failed'

export type OriginalTrackDiscoveryState = Readonly<{
  isOpen: boolean
  sourceTrackId: string | null
  status: OriginalTrackDiscoveryStatus
  step: OriginalTrackDiscoveryStep
  candidates: OriginalTrackDiscoveryCandidate[]
  localCandidates: LocalOriginalCandidateDto[]
  externalCandidates: ExternalOriginalCandidateDto[]
  releaseCandidates: ExternalOriginalCandidateDto[]
  deepCandidates: ExternalOriginalCandidateDto[]
  hasReliableLocalCandidate: boolean
  externalStatus: ExternalDiscoveryStatus
  deepSearchStatus: ExternalDiscoveryStatus
  providerStatuses: ExternalProviderOperationStatusDto[]
  externalWarnings: string[]
  searchDiagnostics: ExternalProviderSearchDiagnosticDto[]
  externalError: string
  selectedCandidateKey: string | null
  relationTypeCode: string | null
  candidateScrollOffset: number
  selectedExternalRouteKey: string | null
  discoveryError: string
  discoveryErrorCode: string | null
  mutationError: string
  submitting: boolean
}>

export type OriginalCandidateLoader = (
  trackId: string,
  options: ListLocalOriginalCandidatesOptions,
) => Promise<LocalOriginalCandidateListDto>

export type ExternalOriginalCandidateLoader = (
  trackId: string,
  options: FindExternalOriginalCandidatesOptions,
) => Promise<ExternalOriginalCandidateListDto>

export type OriginalCandidateConfirmation = (
  command: StackRelationCommand,
) => Promise<void>

export type OriginalTrackDiscoveryConfirmedResult = Readonly<{
  candidate: LocalOriginalCandidateDto
  relationTypeCode: string
}>

export type UseOriginalTrackDiscoveryOptions = Readonly<{
  relationTypeOptions: readonly StackRelationTypeOption[]
  loadCandidates?: OriginalCandidateLoader
  loadExternalCandidates?: ExternalOriginalCandidateLoader
  confirmStackRelation?: OriginalCandidateConfirmation
  onConfirmed?: (result: OriginalTrackDiscoveryConfirmedResult) => void
  createExternalDraft?: (
    request: ExternalReleaseDraftRequestDto,
    options: Readonly<{ signal: AbortSignal }>,
  ) => Promise<ReleaseImportSession>
  onExternalDraftCreated?: (session: ReleaseImportSession) => void
}>
