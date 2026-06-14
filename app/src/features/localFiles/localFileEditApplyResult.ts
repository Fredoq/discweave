import { updateOwnedItemDigitalFile } from '../catalog/catalogApi'

type LocalEditsBridge = NonNullable<
  NonNullable<Window['discweaveDesktop']>['localEdits']
>

export type LocalEditApplyResult = Awaited<
  ReturnType<LocalEditsBridge['apply']>
>
export type LocalEditAppliedFile = LocalEditApplyResult['files'][number]

export async function reconcileCatalogFiles(files: LocalEditAppliedFile[]) {
  const failures: string[] = []
  for (const file of files) {
    try {
      await updateOwnedItemDigitalFile(file.ownedItemId, {
        path: file.path,
        format: file.format,
        sizeBytes: file.sizeBytes,
        lastModifiedAt: file.lastModifiedAt,
        contentHash: file.contentHash,
      })
    } catch {
      failures.push(file.ownedItemId)
    }
  }

  return failures
}

export function partialApplyStatus(
  result: LocalEditApplyResult,
  catalogFailureCount: number,
) {
  if (result.files.length === 0) {
    return ''
  }

  const updatedCount = result.files.length
  const failedCount = Math.max(1, localFailureCount(result))
  const summary = `${updatedCount} ${plural(updatedCount, 'file')} updated, ${failedCount} failed.`
  const reconciliation =
    updatedCount > 0 && catalogFailureCount === 0
      ? ' Catalog metadata reconciled for updated files.'
      : ''
  const catalogFailures =
    catalogFailureCount > 0
      ? ` ${catalogFailureCount} catalog ${plural(catalogFailureCount, 'update')} failed.`
      : ''
  const operationLog = result.operationLogPath
    ? ` Operation log: ${result.operationLogPath}`
    : ''

  return `${summary}${reconciliation}${catalogFailures}${operationLog}`
}

export function partialApplyError(
  result: LocalEditApplyResult,
  catalogFailureCount: number,
) {
  if (result.files.length === 0) {
    return 'Local edit was not applied. Resolve the validation issues.'
  }

  if (catalogFailureCount > 0) {
    return catalogFailureMessage(catalogFailureCount)
  }

  return 'Some local edits failed. Updated files were reconciled with the catalog.'
}

function localFailureCount(result: LocalEditApplyResult) {
  return (
    result.changes?.filter((change) =>
      change.issues.some((issue) => issue.severity === 'error'),
    ).length ?? 0
  )
}

export function catalogFailureMessage(count: number) {
  return `Catalog metadata failed to update for ${count} ${plural(count, 'file')}. Use the operation log to reconcile the remaining file metadata.`
}

function plural(count: number, singular: string) {
  return count === 1 ? singular : `${singular}s`
}
