import { useEffect, useRef } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { DeleteSessionRecordButton } from '../manualEntry/DeleteSessionRecordButton'

type ArtistInspectorActionsProps = Readonly<{
  onDelete?: () => void
  onUpdateViaDiscogs?: () => void
  canUpdateViaDiscogs: boolean
}>

function useActionsDisclosure() {
  const actionsRef = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    function closeOutside(event: Event) {
      if (!actionsRef.current?.contains(event.target as Node)) {
        actionsRef.current?.removeAttribute('open')
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      const actions = actionsRef.current
      if (event.key !== 'Escape' || !actions?.contains(event.target as Node))
        return
      event.preventDefault()
      actions.removeAttribute('open')
      actions.querySelector('summary')?.focus()
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('focusin', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('focusin', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])
  return actionsRef
}

export function ArtistInspectorActions({
  onDelete,
  onUpdateViaDiscogs,
  canUpdateViaDiscogs,
}: ArtistInspectorActionsProps) {
  const actionsRef = useActionsDisclosure()
  function closeAndRun(action: () => void) {
    actionsRef.current?.removeAttribute('open')
    action()
  }
  return (
    <details className="artist-inspector-actions" ref={actionsRef}>
      <summary
        tabIndex={0}
        aria-label="More artist actions"
        title="More artist actions"
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </summary>
      <div className="artist-inspector-action-list">
        {onUpdateViaDiscogs ? (
          <>
            <button
              className="button button-secondary"
              type="button"
              disabled={!canUpdateViaDiscogs}
              aria-describedby={
                !canUpdateViaDiscogs ? 'artist-discogs-disabled' : undefined
              }
              onClick={() => closeAndRun(onUpdateViaDiscogs)}
            >
              Update via Discogs
            </button>
            {!canUpdateViaDiscogs ? (
              <span
                className="discogs-disabled-note"
                id="artist-discogs-disabled"
              >
                Add a Discogs token in Settings to use Discogs lookup.
              </span>
            ) : null}
          </>
        ) : null}
        {onDelete ? (
          <DeleteSessionRecordButton
            confirmationMessage="Delete this artist and remove their credits and relations?"
            onDelete={() => closeAndRun(onDelete)}
          />
        ) : null}
      </div>
    </details>
  )
}
