import { useMemo, useRef, useState } from 'react'
import type { ReviewWorkbenchItem } from './reviewWorkbenchApi'
import { duplicateTrackIds } from './duplicateTrackReview'
import { DuplicateTrackReviewDialog } from './DuplicateTrackReviewDialog'
import './duplicate-track-review.css'

export function DuplicateTrackReviewAction({
  item,
  onOpenTarget,
  onChanged,
}: Readonly<{
  onChanged?: () => void
  item: ReviewWorkbenchItem
  onOpenTarget: (item: ReviewWorkbenchItem) => void
}>) {
  const idsKey = JSON.stringify(duplicateTrackIds(item))
  const ids = useMemo(() => JSON.parse(idsKey) as string[], [idsKey])
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  if (ids.length < 2) return null
  return (
    <>
      <button
        ref={buttonRef}
        className="button button-secondary button-compact"
        type="button"
        aria-label={`Compare records ${item.title}`}
        onClick={() => setOpen(true)}
      >
        Compare {ids.length} records
      </button>
      {open ? (
        <DuplicateTrackReviewDialog
          key={idsKey}
          ids={ids}
          onChanged={onChanged}
          onClose={() => {
            setOpen(false)
            buttonRef.current?.focus()
          }}
          onOpen={(kind, id, title) =>
            onOpenTarget({
              ...item,
              targets: [{ kind, id, title }],
              navigationTarget: null,
            })
          }
        />
      ) : null}
    </>
  )
}
