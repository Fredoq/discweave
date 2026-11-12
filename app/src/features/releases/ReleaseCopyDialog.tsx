import { useEffect, useId, useRef, type ReactNode } from 'react'

export function ReleaseCopyDialog({
  title,
  busy,
  children,
  onClose,
}: Readonly<{
  title: string
  busy: boolean
  children: ReactNode
  onClose: () => void
}>) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const dialog = ref.current
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    return () => {
      if (dialog?.open && typeof dialog.close === 'function') dialog.close()
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  useEffect(() => {
    const target =
      ref.current?.querySelector<HTMLElement>(
        'form input, form select, form textarea',
      ) ?? ref.current?.querySelector<HTMLElement>('h2')
    target?.focus()
  }, [title])
  return (
    <dialog
      ref={ref}
      className="release-copy-dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <div className="release-copy-dialog__heading">
        <h2 id={titleId} tabIndex={-1}>
          {title}
        </h2>
        <button
          className="button button-secondary"
          type="button"
          onClick={onClose}
          disabled={busy}
        >
          Close
        </button>
      </div>
      {children}
    </dialog>
  )
}
