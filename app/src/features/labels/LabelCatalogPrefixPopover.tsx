import { useEffect, useId, useRef, useState } from 'react'
import { catalogSearchKey } from './labelDiscogsModel'

export type LabelCatalogPrefixPopoverProps = Readonly<{
  initialPrefixes: string[]
  options: [string, number][]
  pending: boolean
  error?: string
  onApply: (prefixes: string[]) => Promise<boolean>
  onCancel: () => void
}>

export function LabelCatalogPrefixPopover({
  initialPrefixes,
  options,
  pending,
  error,
  onApply,
  onCancel,
}: LabelCatalogPrefixPopoverProps) {
  const panelRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const mounted = useRef(false)
  const applying = useRef(false)
  const onCancelRef = useRef(onCancel)
  const restoreFocus = useRef(true)
  useEffect(() => {
    onCancelRef.current = onCancel
  }, [onCancel])
  const [draft, setDraft] = useState(() => [...initialPrefixes])
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)
  const [applyError, setApplyError] = useState('')
  const titleId = useId()
  const noteId = useId()
  const customId = useId()
  const blocked = pending || busy
  const normalizedCustom = catalogSearchKey(custom)
  const allOptions = [...options]
  for (const prefix of draft)
    if (!allOptions.some(([value]) => value === prefix))
      allOptions.push([prefix, 0])

  useEffect(() => {
    mounted.current = true
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    triggerRef.current = previousFocus
    panelRef.current
      ?.querySelector<HTMLElement>(
        'input:not(:disabled), button:not(:disabled)',
      )
      ?.focus()
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !panelRef.current?.contains(event.target) &&
        (previousFocus === document.body ||
          !previousFocus?.contains(event.target))
      )
        onCancelRef.current()
    }
    document.addEventListener('pointerdown', outside)
    return () => {
      mounted.current = false
      document.removeEventListener('pointerdown', outside)
      if (restoreFocus.current && previousFocus?.isConnected)
        previousFocus.focus()
    }
  }, [])

  function toggle(prefix: string) {
    setDraft((previous) => {
      if (previous.includes(prefix))
        return previous.filter((value) => value !== prefix)
      if (previous.length < 50) return [...previous, prefix]
      return previous
    })
  }
  async function apply() {
    if (blocked || applying.current) return
    applying.current = true
    setBusy(true)
    setApplyError('')
    try {
      await onApply(draft)
    } catch {
      if (mounted.current)
        setApplyError('The filters could not be saved. Try again.')
    } finally {
      applying.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <dialog
      open
      ref={panelRef}
      aria-labelledby={titleId}
      aria-describedby={noteId}
      className="label-prefix-popover"
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget) &&
          !triggerRef.current?.contains(event.relatedTarget)
        ) {
          restoreFocus.current = false
          onCancel()
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onCancel()
        }
      }}
    >
      <h3 id={titleId}>Select prefixes</h3>
      <p id={noteId} className="label-prefix-popover__note">
        Suggested from loaded numbers, not official series. No selection shows
        all numbers, including entries without a number.
      </p>
      <div className="label-prefix-popover__options">
        {allOptions.map(([prefix, count]) => (
          <label key={prefix}>
            <input
              type="checkbox"
              checked={draft.includes(prefix)}
              disabled={
                blocked || (!draft.includes(prefix) && draft.length >= 50)
              }
              onChange={() => toggle(prefix)}
            />
            <span>
              {prefix} <small>({count})</small>
            </span>
          </label>
        ))}
      </div>
      <form
        className="label-prefix-popover__custom"
        onSubmit={(event) => {
          event.preventDefault()
          if (
            !blocked &&
            normalizedCustom &&
            normalizedCustom.length <= 64 &&
            !draft.includes(normalizedCustom) &&
            draft.length < 50
          ) {
            setDraft((previous) => [...previous, normalizedCustom])
            setCustom('')
          }
        }}
      >
        <label htmlFor={customId}>Add custom prefix</label>
        <div>
          <input
            id={customId}
            value={custom}
            maxLength={64}
            placeholder="e.g. 50CD"
            onChange={(event) => setCustom(event.target.value)}
          />
          <button
            className="button button-secondary"
            type="submit"
            disabled={
              blocked ||
              !normalizedCustom ||
              normalizedCustom.length > 64 ||
              draft.includes(normalizedCustom) ||
              draft.length >= 50
            }
          >
            Add
          </button>
        </div>
      </form>
      {error || applyError ? (
        <p role="alert" className="label-prefix-popover__error">
          {error || applyError}
        </p>
      ) : null}
      <footer className="label-prefix-popover__footer">
        <button
          className="button button-quiet"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="button button-primary"
          type="button"
          disabled={blocked}
          onClick={() => void apply()}
        >
          Apply filters
        </button>
      </footer>
    </dialog>
  )
}
