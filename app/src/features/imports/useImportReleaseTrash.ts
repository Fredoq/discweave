import { useCallback, useState } from 'react'
import type { ReleaseImportDraft } from '../catalog/catalogApi'
import {
  canTrashImportDraft,
  isImportReleaseTrashAvailable,
  planImportReleaseTrash,
  trashImportRelease,
  type ImportReleaseTrashPlan,
} from './importFileActions'

export type ImportReleaseTrashState =
  | { status: 'closed' }
  | { status: 'planning' }
  | { status: 'ready'; plan: ImportReleaseTrashPlan }
  | { status: 'trashing'; plan: ImportReleaseTrashPlan }
  | { status: 'failed'; plan: ImportReleaseTrashPlan | null; message: string }

export type ImportReleaseTrash = Readonly<{
  isAvailable: boolean
  state: ImportReleaseTrashState
  draftId: string | null
  open: (draft: ReleaseImportDraft) => Promise<void>
  cancel: () => void
  confirm: (draft: ReleaseImportDraft) => Promise<void>
}>

export function useImportReleaseTrash(
  onTrashed: () => Promise<void>,
): ImportReleaseTrash {
  const [state, setState] = useState<ImportReleaseTrashState>({
    status: 'closed',
  })
  const [draftId, setDraftId] = useState<string | null>(null)
  const isAvailable = isImportReleaseTrashAvailable()

  const open = useCallback(async (draft: ReleaseImportDraft) => {
    if (!canTrashImportDraft(draft)) {
      return
    }

    setDraftId(draft.id)
    setState({ status: 'planning' })
    try {
      setState({ status: 'ready', plan: await planImportReleaseTrash(draft) })
    } catch (error) {
      setState({
        status: 'failed',
        plan: null,
        message: errorMessage(error, 'Could not inspect the release files.'),
      })
    }
  }, [])

  const cancel = useCallback(() => {
    setState({ status: 'closed' })
    setDraftId(null)
  }, [])

  const confirm = useCallback(
    async (draft: ReleaseImportDraft) => {
      if (state.status !== 'ready' || draftId !== draft.id) {
        return
      }

      const plan = state.plan
      setState({ status: 'trashing', plan })
      try {
        const result = await trashImportRelease(draft)
        if (!result.ok) {
          setState({
            status: 'failed',
            plan,
            message: partialFailureMessage(
              result.trashedPaths.length,
              result.message,
            ),
          })
          return
        }
      } catch (error) {
        setState({
          status: 'failed',
          plan,
          message: errorMessage(error, 'Could not move the release to Trash.'),
        })
        return
      }

      cancel()
      await onTrashed()
    },
    [cancel, draftId, onTrashed, state],
  )

  return { isAvailable, state, draftId, open, cancel, confirm }
}

function partialFailureMessage(movedCount: number, message?: string) {
  const reason = message ?? 'The system could not move a file.'
  return movedCount > 0
    ? `${reason} ${movedCount} ${movedCount === 1 ? 'item was' : 'items were'} already moved to Trash.`
    : reason
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}
