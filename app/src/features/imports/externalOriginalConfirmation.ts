import type {
  ReleaseImportConfirmationPreflight,
  ReleaseImportDraft,
} from '../catalog/catalogApi'

type SavedExternalDraft = Readonly<{
  sessionId: string
  draft: ReleaseImportDraft
}>

type Operations<TSession> = Readonly<{
  draft: ReleaseImportDraft
  saveDraft: () => Promise<SavedExternalDraft | null>
  preflight: (
    sessionId: string,
    draft: ReleaseImportDraft,
  ) => Promise<ReleaseImportConfirmationPreflight>
  confirm: (sessionId: string, draftId: string) => Promise<TSession>
}>

export type ExternalOriginalConfirmationResult<TSession> =
  | Readonly<{ kind: 'notSaved' }>
  | Readonly<{
      kind: 'blocked'
      preflight: ReleaseImportConfirmationPreflight
    }>
  | Readonly<{ kind: 'confirmed'; session: TSession }>

export async function executeExternalOriginalConfirmation<TSession>({
  draft,
  saveDraft,
  preflight,
  confirm,
}: Operations<TSession>): Promise<
  ExternalOriginalConfirmationResult<TSession>
> {
  const saved = await saveDraft()
  if (!saved) {
    return { kind: 'notSaved' }
  }

  const preflightResult = await preflight(saved.sessionId, saved.draft)
  if (!preflightResult.canConfirm) {
    return { kind: 'blocked', preflight: preflightResult }
  }

  return {
    kind: 'confirmed',
    session: await confirm(saved.sessionId, draft.id),
  }
}
