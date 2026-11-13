import { useRef, useState } from 'react'
import { ReleaseDateReviewDialog } from './ReleaseDateReviewDialog'
import './release-date-review.css'

export function ReleaseDateReviewAction({
  releaseId,
  initialQuery,
  onChanged,
}: Readonly<{
  initialQuery?: string
  releaseId: string
  onChanged?: () => void
}>) {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={button}
        className="button button-secondary button-compact"
        type="button"
        onClick={() => setOpen(true)}
      >
        Review date
      </button>
      {open && (
        <ReleaseDateReviewDialog
          key={releaseId}
          releaseId={releaseId}
          initialQuery={initialQuery}
          onChanged={onChanged}
          onClose={() => {
            setOpen(false)
            button.current?.focus()
          }}
        />
      )}
    </>
  )
}
