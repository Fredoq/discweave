import { useEffect, useState } from 'react'
import { loadTrackStackSettings } from '../catalog/api/settingsClient'
import { defaultTrackStackRelationTypeCodes } from './trackStackModel'

export type TrackStackRelationTypeState = Readonly<{
  codes: string[]
  status: 'loading' | 'ready' | 'error'
}>

const localState: TrackStackRelationTypeState = {
  codes: [...defaultTrackStackRelationTypeCodes],
  status: 'ready',
}

const initialServerState: TrackStackRelationTypeState = {
  codes: [],
  status: 'loading',
}

export function useTrackStackRelationTypeState(
  serverBackedCatalog: boolean,
): TrackStackRelationTypeState {
  const [serverState, setServerState] =
    useState<TrackStackRelationTypeState>(initialServerState)

  useEffect(() => {
    if (!serverBackedCatalog) {
      return
    }

    let isActive = true
    void loadTrackStackSettings()
      .then((settings) => {
        if (!isActive) {
          return
        }
        if (!settings) {
          setServerState({ codes: [], status: 'error' })
          return
        }

        const response = settings as {
          defaultRelationTypeCodes?: string[]
          relationTypeCodes?: string[]
        }
        setServerState({
          codes: [
            ...(response.defaultRelationTypeCodes ??
              response.relationTypeCodes ??
              []),
          ],
          status: 'ready',
        })
      })
      .catch(() => {
        if (isActive) {
          setServerState({ codes: [], status: 'error' })
        }
      })

    return () => {
      isActive = false
    }
  }, [serverBackedCatalog])

  return serverBackedCatalog ? serverState : localState
}
