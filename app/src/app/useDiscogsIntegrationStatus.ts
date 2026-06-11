import { useCallback, useEffect, useState } from 'react'
import {
  CatalogApiError,
  defaultDiscogsIntegrationStatus,
  loadDiscogsIntegrationStatus,
  type CatalogState,
} from '../features/catalog/catalogApi'
import type { AppRoutePath } from './routes'
import {
  routeRequiresFullCatalog,
  routeUsesDiscogsIntegrationStatus,
} from './routeRequirements'

export function useDiscogsIntegrationStatus({
  activePath,
  hasLoadedFullCatalog,
  initialCatalogState,
  onLogout,
}: {
  activePath: AppRoutePath
  hasLoadedFullCatalog: boolean
  initialCatalogState: CatalogState | null
  onLogout: () => void
}) {
  const [discogsIntegrationStatus, setDiscogsIntegrationStatus] = useState(
    initialCatalogState?.discogsIntegration ??
      (initialCatalogState
        ? defaultDiscogsIntegrationStatus
        : { ...defaultDiscogsIntegrationStatus, configured: false }),
  )
  const [
    hasLoadedDiscogsIntegrationStatus,
    setHasLoadedDiscogsIntegrationStatus,
  ] = useState(Boolean(initialCatalogState))

  const handleDiscogsIntegrationStatusChange = useCallback(
    (status: NonNullable<CatalogState['discogsIntegration']>) => {
      setDiscogsIntegrationStatus(status)
      setHasLoadedDiscogsIntegrationStatus(true)
    },
    [],
  )

  const markDiscogsIntegrationUnconfigured = useCallback(() => {
    handleDiscogsIntegrationStatusChange({
      ...defaultDiscogsIntegrationStatus,
      configured: false,
    })
  }, [handleDiscogsIntegrationStatusChange])

  useEffect(() => {
    if (
      initialCatalogState ||
      hasLoadedDiscogsIntegrationStatus ||
      !routeUsesDiscogsIntegrationStatus(activePath) ||
      (routeRequiresFullCatalog(activePath) && !hasLoadedFullCatalog)
    ) {
      return
    }

    let isCurrent = true

    void loadDiscogsIntegrationStatus()
      .then((status) => {
        if (isCurrent && status) {
          handleDiscogsIntegrationStatusChange(status)
        }
      })
      .catch((error) => {
        if (!isCurrent) {
          return
        }

        if (error instanceof CatalogApiError && error.status === 401) {
          onLogout()
          return
        }

        markDiscogsIntegrationUnconfigured()
      })

    return () => {
      isCurrent = false
    }
  }, [
    activePath,
    handleDiscogsIntegrationStatusChange,
    hasLoadedDiscogsIntegrationStatus,
    hasLoadedFullCatalog,
    initialCatalogState,
    markDiscogsIntegrationUnconfigured,
    onLogout,
  ])

  return {
    discogsIntegrationStatus,
    handleDiscogsIntegrationStatusChange,
  }
}
