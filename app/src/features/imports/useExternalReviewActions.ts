import { useCallback } from 'react'
import type {
  CatalogDictionaries,
  ExternalDiscogsBindingRebindRequest,
  ExternalMetadataReleaseDetailDto,
  ExternalMusicBrainzBindingRebindRequest,
  ReleaseImportDraft,
  ReleaseImportSession,
} from '../catalog/catalogApi'
import {
  attachExternalDiscogsRelease,
  rebindExternalDiscogsBinding,
  rebindExternalMusicBrainzBinding,
  selectExternalReleaseProvenance,
  selectExternalTrackProvenance,
} from '../catalog/catalogApi'
import type { ArtistRecord } from '../artists/artistsData'
import type { DiscogsApplyGroups } from '../releases/DiscogsReleaseLookupPanel'
import { cloneDraft } from './importHelpers'
import { applyDiscogsReleaseToImportDraft } from './importDiscogsApply'

type Props = Readonly<{
  artists: ArtistRecord[]
  dictionaries: CatalogDictionaries
  draft: ReleaseImportDraft | null
  selectedSession: ReleaseImportSession | null
  setConfirmationPreflight: (value: null) => void
  setDraft: (value: ReleaseImportDraft | null) => void
  setError: (value: string | null) => void
  setPendingAction: (value: string | null) => void
  setSelectedDraftId: (value: string) => void
  setSelectedSession: (value: ReleaseImportSession) => void
  setStatus: (value: string) => void
  handleRequestError: (requestError: unknown, nextStatus: string) => boolean
}>

export function useExternalReviewActions({
  artists,
  dictionaries,
  draft,
  selectedSession,
  setConfirmationPreflight,
  setDraft,
  setError,
  setPendingAction,
  setSelectedDraftId,
  setSelectedSession,
  setStatus,
  handleRequestError,
}: Props) {
  const applyReturnedSession = useCallback(
    (session: ReleaseImportSession, draftId: string) => {
      const returnedDraft =
        session.drafts?.find((item) => item.id === draftId) ?? null
      setSelectedSession(session)
      setSelectedDraftId(draftId)
      setDraft(returnedDraft ? cloneDraft(returnedDraft) : null)
      setConfirmationPreflight(null)
    },
    [
      setConfirmationPreflight,
      setDraft,
      setSelectedDraftId,
      setSelectedSession,
    ],
  )

  const rebindMusicBrainz = useCallback(
    async (
      request: Omit<
        ExternalMusicBrainzBindingRebindRequest,
        'expectedReviewRevision'
      >,
    ) => {
      if (
        !selectedSession ||
        !draft ||
        draft.sourceKind !== 'externalMetadata'
      ) {
        return
      }

      const draftId = draft.id
      setPendingAction('external-binding-rebind')
      setStatus('Validating MusicBrainz binding')
      setError(null)
      try {
        const session = await rebindExternalMusicBrainzBinding(
          selectedSession.id,
          draftId,
          {
            ...request,
            expectedReviewRevision: draft.externalReviewRevision ?? 0,
          },
        )
        applyReturnedSession(session, draftId)
        setStatus('MusicBrainz binding updated')
      } catch (requestError) {
        handleRequestError(requestError, 'Binding update failed')
      } finally {
        setPendingAction(null)
      }
    },
    [
      applyReturnedSession,
      draft,
      handleRequestError,
      selectedSession,
      setError,
      setPendingAction,
      setStatus,
    ],
  )

  const rebindDiscogs = useCallback(
    async (
      request: Omit<
        ExternalDiscogsBindingRebindRequest,
        'expectedReviewRevision'
      >,
    ) => {
      if (
        !selectedSession ||
        !draft ||
        draft.sourceKind !== 'externalMetadata'
      ) {
        return
      }

      const draftId = draft.id
      setPendingAction('external-binding-rebind')
      setStatus('Validating Discogs-backed binding')
      setError(null)
      try {
        const session = await rebindExternalDiscogsBinding(
          selectedSession.id,
          draftId,
          {
            ...request,
            expectedReviewRevision: draft.externalReviewRevision ?? 0,
          },
        )
        applyReturnedSession(session, draftId)
        setStatus('Discogs-backed binding updated')
      } catch (requestError) {
        handleRequestError(requestError, 'Binding update failed')
      } finally {
        setPendingAction(null)
      }
    },
    [
      applyReturnedSession,
      draft,
      handleRequestError,
      selectedSession,
      setError,
      setPendingAction,
      setStatus,
    ],
  )

  const applyDiscogsRelease = useCallback(
    async (
      detail: ExternalMetadataReleaseDetailDto,
      groups: DiscogsApplyGroups,
    ) => {
      if (
        !selectedSession ||
        !draft ||
        draft.sourceKind !== 'externalMetadata' ||
        !draft.selectedOriginalBinding
      ) {
        return false
      }

      const draftId = draft.id
      setPendingAction('external-discogs-attach')
      setStatus('Linking Discogs release')
      setError(null)
      try {
        const session = await attachExternalDiscogsRelease(
          selectedSession.id,
          draftId,
          detail.source.externalId,
          draft.externalReviewRevision ?? 0,
        )
        const canonicalDraft = session.drafts?.find(
          (item) => item.id === draftId,
        )
        if (!canonicalDraft) {
          throw new Error('The updated release draft was not returned.')
        }

        const editableDraft = applyDiscogsReleaseToImportDraft({
          artists,
          detail,
          dictionaries,
          draft: cloneDraft(canonicalDraft),
          groups,
          includeExternalSources: false,
        })
        setSelectedSession(session)
        setSelectedDraftId(draftId)
        setDraft(editableDraft)
        setConfirmationPreflight(null)
        setStatus('Discogs release linked and fields applied')
        return true
      } catch (requestError) {
        return handleRequestError(
          requestError,
          'Discogs release could not be linked',
        )
      } finally {
        setPendingAction(null)
      }
    },
    [
      artists,
      dictionaries,
      draft,
      handleRequestError,
      selectedSession,
      setConfirmationPreflight,
      setDraft,
      setError,
      setPendingAction,
      setSelectedDraftId,
      setSelectedSession,
      setStatus,
    ],
  )

  const selectRelease = useCallback(
    async (releaseId: string) => {
      if (
        !selectedSession ||
        !draft ||
        draft.sourceKind !== 'externalMetadata'
      ) {
        return
      }

      const draftId = draft.id
      setPendingAction('external-provenance-release')
      setStatus('Selecting collection release')
      setError(null)
      try {
        const session = await selectExternalReleaseProvenance(
          selectedSession.id,
          draftId,
          releaseId,
          draft.externalReviewRevision ?? 0,
        )
        applyReturnedSession(session, draftId)
        setStatus('Collection release selected')
      } catch (requestError) {
        handleRequestError(requestError, 'Release provenance update failed')
      } finally {
        setPendingAction(null)
      }
    },
    [
      applyReturnedSession,
      draft,
      handleRequestError,
      selectedSession,
      setError,
      setPendingAction,
      setStatus,
    ],
  )

  const selectTrack = useCallback(
    async (trackId: string) => {
      if (
        !selectedSession ||
        !draft ||
        draft.sourceKind !== 'externalMetadata'
      ) {
        return
      }

      const draftId = draft.id
      setPendingAction('external-provenance-track')
      setStatus('Selecting collection track')
      setError(null)
      try {
        const session = await selectExternalTrackProvenance(
          selectedSession.id,
          draftId,
          trackId,
          draft.externalReviewRevision ?? 0,
        )
        applyReturnedSession(session, draftId)
        setStatus('Collection track selected')
      } catch (requestError) {
        handleRequestError(requestError, 'Track provenance update failed')
      } finally {
        setPendingAction(null)
      }
    },
    [
      applyReturnedSession,
      draft,
      handleRequestError,
      selectedSession,
      setError,
      setPendingAction,
      setStatus,
    ],
  )

  return {
    applyDiscogsRelease,
    rebindDiscogs,
    rebindMusicBrainz,
    selectRelease,
    selectTrack,
  }
}
