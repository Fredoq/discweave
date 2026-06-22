import { useState, type ChangeEvent } from 'react'
import { CatalogApiError, restoreJsonSnapshot } from '../catalog/catalogApi'
import { errorMessage } from './importHelpers'
import { readFileText, restoreSummary } from './importWorkspaceHelpers'

type ImportRestoreControllerOptions = Readonly<{
  onCatalogChanged: () => void
  onSessionExpired: () => void
}>

export function useImportRestoreController({
  onCatalogChanged,
  onSessionExpired,
}: ImportRestoreControllerOptions) {
  const [pendingRestore, setPendingRestore] = useState(false)
  const [restoreInputKey, setRestoreInputKey] = useState(0)
  const [restoreStatus, setRestoreStatus] = useState('Ready')
  const [restoreError, setRestoreError] = useState<string | null>(null)

  async function handleRestoreFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    if (!file) {
      return
    }

    setPendingRestore(true)
    setRestoreStatus('Restoring JSON backup')
    setRestoreError(null)

    try {
      const snapshot = JSON.parse(await readFileText(file)) as unknown
      const result = await restoreJsonSnapshot(snapshot)
      onCatalogChanged()
      setRestoreStatus(restoreSummary(result))
      setRestoreInputKey((key) => key + 1)
    } catch (requestError) {
      if (requestError instanceof SyntaxError) {
        setRestoreError('Select a valid JSON backup.')
      } else if (
        requestError instanceof CatalogApiError &&
        requestError.code === 'export_restore.collection_not_empty'
      ) {
        setRestoreError('Restore requires an empty collection.')
      } else if (
        requestError instanceof CatalogApiError &&
        requestError.status === 401
      ) {
        onSessionExpired()
      } else {
        setRestoreError(errorMessage(requestError))
      }
      setRestoreStatus('Restore failed')
      setRestoreInputKey((key) => key + 1)
    } finally {
      setPendingRestore(false)
    }
  }

  return {
    handleRestoreFileChange,
    pendingRestore,
    restoreError,
    restoreInputKey,
    restoreStatus,
  }
}

export type ImportRestoreController = ReturnType<
  typeof useImportRestoreController
>
