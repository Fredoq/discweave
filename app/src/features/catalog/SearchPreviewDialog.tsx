import { useEffect, useId, useRef, type ReactNode } from 'react'

export function SearchPreviewDialog({
  title,
  children,
  onClose,
}: Readonly<{
  title: string
  children: ReactNode
  onClose: () => void
}>) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    closeRef.current?.focus()
    return () => {
      if (dialog?.open && typeof dialog.close === 'function') dialog.close()
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="search-preview-dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="search-preview-dialog__header">
        <h2 id={titleId}>Preview: {title}</h2>
        <button
          ref={closeRef}
          className="button button-secondary"
          type="button"
          onClick={onClose}
        >
          Close preview
        </button>
      </div>
      {children}
    </dialog>
  )
}
