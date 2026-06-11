import {
  getInitialCatalogStateForTests,
  updateTestCatalogState,
} from './testCatalogStore'
import type { DiscogsIntegrationStatus } from './catalogTypes'
import { CatalogApiError, getJson, readJsonBody, sendJson } from './httpClient'

export async function loadDiscogsIntegrationStatus() {
  const testCatalogState = getInitialCatalogStateForTests()
  if (testCatalogState?.discogsIntegration) {
    return testCatalogState.discogsIntegration
  }

  return getJson<DiscogsIntegrationStatus>('/api/settings/integrations/discogs')
}

export async function saveDiscogsAccessToken(accessToken: string) {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      discogsIntegration: {
        providerName: 'discogs',
        enabled: true,
        configured: true,
      },
    }))
  ) {
    return getInitialCatalogStateForTests()?.discogsIntegration
  }

  return sendJson<DiscogsIntegrationStatus>(
    '/api/settings/integrations/discogs/token',
    'PUT',
    { accessToken },
  )
}

export async function removeDiscogsAccessToken() {
  if (
    updateTestCatalogState((state) => ({
      ...state,
      discogsIntegration: {
        providerName: 'discogs',
        enabled: false,
        configured: false,
      },
    }))
  ) {
    return getInitialCatalogStateForTests()?.discogsIntegration
  }

  const response = await fetch('/api/settings/integrations/discogs/token', {
    credentials: 'include',
    method: 'DELETE',
  })

  if (!response.ok) {
    throw await CatalogApiError.fromResponse(response)
  }

  return (await readJsonBody<DiscogsIntegrationStatus>(response)) ?? null
}
