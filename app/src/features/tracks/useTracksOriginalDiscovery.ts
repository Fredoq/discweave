import { useCallback, useRef, useState } from 'react'
import type { StackRelationTypeOption } from './trackStackModel'
import type { TrackRecord } from './tracksData'
import {
  useOriginalTrackDiscovery,
  type OriginalTrackDiscoveryConfirmedResult,
} from './useOriginalTrackDiscovery'

type UseTracksOriginalDiscoveryOptions = Readonly<{
  relationTypeOptions: readonly StackRelationTypeOption[]
  onCatalogChanged?: () => void
  onRefreshStacks: () => void
}>

export function useTracksOriginalDiscovery({
  relationTypeOptions,
  onCatalogChanged,
  onRefreshStacks,
}: UseTracksOriginalDiscoveryOptions) {
  const findOriginalButtonRef = useRef<HTMLButtonElement | null>(null)
  const [sourceTrack, setSourceTrack] = useState<TrackRecord | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const handleConfirmed = useCallback(
    (result: OriginalTrackDiscoveryConfirmedResult) => {
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
      onCatalogChanged?.()
    },
    [onCatalogChanged, onRefreshStacks, relationTypeOptions, sourceTrack],
  )
  const controller = useOriginalTrackDiscovery({
    relationTypeOptions,
    onConfirmed: handleConfirmed,
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
