import { Trash2 } from 'lucide-react'

export function MoveToTrashButton({
  isConfirmed,
  disabled,
  onMoveToTrash,
}: Readonly<{
  disabled: boolean
  isConfirmed: boolean
  onMoveToTrash: () => void
}>) {
  return (
    <button
      className="button button-danger imports-trash-button"
      disabled={disabled}
      title={
        isConfirmed
          ? 'Already in the catalog. Delete the release from the catalog first.'
          : 'Move this release folder to the Trash'
      }
      type="button"
      onClick={onMoveToTrash}
    >
      <Trash2 size={16} /> Move to Trash
    </button>
  )
}
