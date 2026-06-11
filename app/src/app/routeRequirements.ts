import { manualEntryRoutes } from './renderWorkspace'
import type { AppRoutePath } from './routes'

export function routeRequiresFullCatalog(path: AppRoutePath) {
  return manualEntryRoutes.has(path)
}

export function routeUsesDiscogsIntegrationStatus(path: AppRoutePath) {
  return path === '/artists' || path === '/releases' || path === '/tracks'
}
