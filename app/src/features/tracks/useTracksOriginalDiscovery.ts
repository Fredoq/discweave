import { useCallback, useRef, useState } from 'react'
import type { ReleaseImportSession } from '../catalog/api/catalogImportTypes'
import type { TrackRelationDto } from '../catalog/api/catalogDtoTypes'
import type { StackRelationCommand } from '../catalog/api/ownedRelationsClient'
import type { StackRelationTypeOption } from './trackStackModel'
import type { TrackRecord } from './tracksData'
import {
  useOriginalTrackDiscovery,
  type OriginalTrackDiscoveryConfirmedResult,
} from './useOriginalTrackDiscovery'

type UseTracksOriginalDiscoveryOptions = Readonly<{
  relationTypeOptions: readonly StackRelationTypeOption[]
  onCatalogChanged?: () => void
  onStackRelationSaved?: (
    relation: TrackRelationDto,
    command: StackRelationCommand,
  ) => void
  onRefreshStacks: () => void
  onNavigateToUrl?: (href: string) => boolean
}>

export function useTracksOriginalDiscovery({
  relationTypeOptions,
  onCatalogChanged,
  onStackRelationSaved,
  onRefreshStacks,
  onNavigateToUrl,
}: UseTracksOriginalDiscoveryOptions) {
  const findOriginalButtonRef = useRef<HTMLButtonElement | null>(null)
  const [sourceTrack, setSourceTrack] = useState<TrackRecord | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const handleConfirmed = useCallback(
    (
      result: OriginalTrackDiscoveryConfirmedResult,
      relationApplied = false,
    ) => {
      if (!sourceTrack) {
        return
      }

      const relationLabel =
        relationTypeOptions.find(
          (option) => option.code === result.relationTypeCode,
        )?.label ?? result.relationTypeCode
      setAnnouncement(
        `Added ${sourceTrack.title} to ${result.candidate.title} as ${relationLabel}.`,
      )
      onRefreshStacks()
      if (!relationApplied) {
        onCatalogChanged?.()
      }
    },
    [onCatalogChanged, onRefreshStacks, relationTypeOptions, sourceTrack],
  )
  const controller = useOriginalTrackDiscovery({
    relationTypeOptions,
    onStackRelationSaved,
    onConfirmed: handleConfirmed,
    onExternalDraftCreated: (session: ReleaseImportSession) => {
      const draftId = session.drafts?.[0]?.id
      if (draftId && onNavigateToUrl) {
        const params = new URLSearchParams({
          session: session.id,
          draft: draftId,
        })
        onNavigateToUrl(`/imports?${params.toString()}`)
      }
      setAnnouncement('External release draft created.')
      onCatalogChanged?.()
    },
  })
  const openDiscovery = controller.open

  const openFor = useCallback(
    (track: TrackRecord) => {
      setAnnouncement('')
      setSourceTrack(track)
      return openDiscovery(track.id)
    },
    [openDiscovery],
  )

  return {
    announcement,
    controller,
    findOriginalButtonRef,
    openFor,
    sourceTrack,
  }
}
