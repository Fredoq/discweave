import { useEffect, useState } from 'react'
import { loadTrackStacks, type TrackStackDto } from '../catalog/catalogApi'

export type TrackStackProjection = Readonly<{
  stacks: TrackStackDto[] | null
  status: 'loading' | 'ready' | 'error'
}>

type TrackStackProjectionResolution = Readonly<{
  requestKey: string
  stacks: TrackStackDto[] | null
  status: 'ready' | 'error'
}>

export function useServerTrackStacks(
  serverBackedCatalog: boolean,
  stackRefreshKey: string,
  stackRefreshNonce: number,
): TrackStackProjection {
  const requestKey = `${stackRefreshNonce}:${stackRefreshKey}`
  const [resolution, setResolution] =
    useState<TrackStackProjectionResolution | null>(null)

  useEffect(() => {
    if (!serverBackedCatalog) {
      return
    }

    let isActive = true
    void loadTrackStacks()
      .then((response) => {
        if (isActive) {
          setResolution({
            requestKey,
            stacks: response.items,
            status: 'ready',
          })
        }
      })
      .catch(() => {
        if (isActive) {
          setResolution((current) => ({
            requestKey,
            stacks: current?.stacks ?? null,
            status: 'error',
          }))
        }
      })

    return () => {
      isActive = false
    }
  }, [requestKey, serverBackedCatalog])

  if (!serverBackedCatalog) {
    return { stacks: null, status: 'ready' }
  }

  if (resolution?.requestKey !== requestKey) {
    return {
      stacks: resolution?.stacks ?? null,
      status: 'loading',
    }
  }

  return {
    stacks: resolution.stacks,
    status: resolution.status,
  }
}
