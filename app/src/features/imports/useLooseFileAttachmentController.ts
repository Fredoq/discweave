import { useMemo, useState } from 'react'
import {
  CatalogApiError,
  attachLooseFilesToRelease,
  searchImportAttachmentReleases,
  type ReleaseDto,
  type ReleaseImportSession,
} from '../catalog/catalogApi'
import { errorMessage } from './importHelpers'
import {
  attachmentInitialSearch,
  suggestAttachmentMappings,
} from './importWorkspaceHelpers'

type LooseFileAttachmentControllerOptions = Readonly<{
  selectedSession: ReleaseImportSession | null
  refreshSessions: () => Promise<boolean>
  onCatalogChanged: () => void
  onSessionExpired: () => void
  setError: (error: string | null) => void
  setPendingAction: (action: string | null) => void
  setSelectedSession: (session: ReleaseImportSession) => void
  setStatus: (status: string) => void
}>

export function useLooseFileAttachmentController({
  selectedSession,
  refreshSessions,
  onCatalogChanged,
  onSessionExpired,
  setError,
  setPendingAction,
  setSelectedSession,
  setStatus,
}: LooseFileAttachmentControllerOptions) {
  const [attachCandidateIds, setAttachCandidateIds] = useState<string[]>([])
  const [attachReleaseSearch, setAttachReleaseSearch] = useState('')
  const [attachReleaseOptions, setAttachReleaseOptions] = useState<
    ReleaseDto[]
  >([])
  const [attachSelectedReleaseId, setAttachSelectedReleaseId] = useState('')
  const [attachMappings, setAttachMappings] = useState<Record<string, string>>(
    {},
  )
  const [attachConfirmRelink, setAttachConfirmRelink] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const attachCandidateIdSet = useMemo(
    () => new Set(attachCandidateIds),
    [attachCandidateIds],
  )

  const attachCandidates = useMemo(
    () =>
      (selectedSession?.looseFileCandidates ?? []).filter(
        (candidate) =>
          attachCandidateIdSet.has(candidate.id) &&
          candidate.decision === 'pending',
      ),
    [attachCandidateIdSet, selectedSession],
  )

  function clearAttachmentSelection() {
    setAttachCandidateIds([])
    setAttachReleaseOptions([])
    setAttachSelectedReleaseId('')
    setAttachMappings({})
    setAttachConfirmRelink(false)
  }

  function startLooseFileAttachment(candidateIds: string[]) {
    if (candidateIds.length === 0) {
      return
    }

    const selectedCandidateIds = new Set(candidateIds)
    const selectedCandidates = (
      selectedSession?.looseFileCandidates ?? []
    ).filter((candidate) => selectedCandidateIds.has(candidate.id))
    setAttachCandidateIds(candidateIds)
    setAttachReleaseSearch(attachmentInitialSearch(selectedCandidates))
    setAttachReleaseOptions([])
    setAttachSelectedReleaseId('')
    setAttachMappings({})
    setAttachConfirmRelink(false)
    setAttachError(null)
    setStatus('Select release for attachment')
    setError(null)
  }

  function cancelLooseFileAttachment() {
    clearAttachmentSelection()
    setAttachError(null)
    setStatus('Attachment cancelled')
  }

  async function searchAttachmentReleases() {
    setStatus('Searching releases')
    setPendingAction('release-attachment-search')
    setAttachError(null)
    try {
      const response = await searchImportAttachmentReleases(attachReleaseSearch)
      setAttachReleaseOptions(response.items)
      setStatus(
        `${response.total} release${response.total === 1 ? '' : 's'} found`,
      )
      setError(null)
    } catch (requestError) {
      if (
        requestError instanceof CatalogApiError &&
        requestError.status === 401
      ) {
        onSessionExpired()
        return
      }

      setAttachError(errorMessage(requestError))
      setStatus('Release search failed')
    } finally {
      setPendingAction(null)
    }
  }

  function selectAttachmentRelease(release: ReleaseDto) {
    setAttachSelectedReleaseId(release.id)
    setAttachMappings(suggestAttachmentMappings(attachCandidates, release))
    setAttachError(null)
  }

  function updateAttachMapping(candidateId: string, releaseTrackId: string) {
    setAttachMappings((currentMappings) => ({
      ...currentMappings,
      [candidateId]: releaseTrackId,
    }))
  }

  async function confirmLooseFileAttachment() {
    if (!selectedSession || !attachSelectedReleaseId) {
      return
    }

    const mappings = attachCandidates
      .map((candidate) => ({
        candidateId: candidate.id,
        releaseTrackId: attachMappings[candidate.id] ?? '',
        confirmRelink: attachConfirmRelink,
      }))
      .filter((mapping) => mapping.releaseTrackId)
    if (mappings.length === 0) {
      setAttachError('Map at least one loose file to a release track.')
      return
    }

    setStatus('Attaching loose files')
    setPendingAction('loose-file-attachment')
    setAttachError(null)
    try {
      const session = await attachLooseFilesToRelease(selectedSession.id, {
        releaseId: attachSelectedReleaseId,
        mappings,
      })
      setSelectedSession(session)
      clearAttachmentSelection()
      const sessionsLoaded = await refreshSessions()
      if (!sessionsLoaded) {
        return
      }
      onCatalogChanged()
      setStatus('Loose files attached')
      setError(null)
    } catch (requestError) {
      if (
        requestError instanceof CatalogApiError &&
        requestError.status === 401
      ) {
        onSessionExpired()
        return
      }

      setAttachError(errorMessage(requestError))
      setStatus('Attachment failed')
    } finally {
      setPendingAction(null)
    }
  }

  return {
    attachCandidates,
    attachConfirmRelink,
    attachError,
    attachMappings,
    attachReleaseOptions,
    attachReleaseSearch,
    attachSelectedReleaseId,
    cancelLooseFileAttachment,
    confirmLooseFileAttachment,
    searchAttachmentReleases,
    selectAttachmentRelease,
    setAttachConfirmRelink,
    setAttachReleaseSearch,
    startLooseFileAttachment,
    updateAttachMapping,
  }
}

export type LooseFileAttachmentController = ReturnType<
  typeof useLooseFileAttachmentController
>
