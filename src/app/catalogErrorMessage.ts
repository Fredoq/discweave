import { CatalogApiError } from '../features/catalog/catalogApi'

export function catalogErrorMessage(error: unknown) {
  if (error instanceof CatalogApiError) {
    if (error.status === 400 || error.status === 409) {
      return error.message
    }

    if (error.status === 401) {
      return 'Session expired. Sign in again.'
    }

    return 'Catalog request failed. Try again.'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Catalog data could not be loaded.'
}
