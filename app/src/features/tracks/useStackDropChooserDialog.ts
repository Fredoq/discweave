import { useEffect, type RefObject } from 'react'

export function useStackDropChooserDialog(
  isOpen: boolean,
  dialogRef: RefObject<HTMLDialogElement | null>,
  firstChoiceRef: RefObject<HTMLButtonElement | null>,
) {
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal()
      } else {
        dialog.setAttribute('open', '')
      }
    }

    dialog?.scrollIntoView?.({
      block: 'nearest',
      inline: 'nearest',
    })
    firstChoiceRef.current?.focus()
  }, [dialogRef, firstChoiceRef, isOpen])
}
