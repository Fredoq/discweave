import type { FormEvent, ReactNode } from 'react'
import './manual-entry.css'

type ManualEntryPanelProps = {
  title: string
  requiredMessage: string
  isValid: boolean
  children: ReactNode
  onCancel: () => void
  onSubmit: () => void
  submitLabel?: string
}

export function ManualEntryPanel({
  title,
  requiredMessage,
  isValid,
  children,
  onCancel,
  onSubmit,
  submitLabel = 'Add record',
}: ManualEntryPanelProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isValid) {
      onSubmit()
    }
  }

  return (
    <form
      className="panel manual-entry-panel"
      aria-label={title}
      onSubmit={handleSubmit}
    >
      <div className="manual-entry-header">
        <div>
          <h2>{title}</h2>
          <p>Only the required fields are needed for a catalog record.</p>
        </div>
        <div className="manual-entry-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            type="submit"
            disabled={!isValid}
          >
            {submitLabel}
          </button>
        </div>
      </div>
      <p
        className="manual-entry-validation"
        aria-live="polite"
        role={isValid ? undefined : 'alert'}
      >
        {isValid
          ? 'Optional metadata can be filled in later.'
          : requiredMessage}
      </p>
      <div className="manual-entry-grid">{children}</div>
    </form>
  )
}
