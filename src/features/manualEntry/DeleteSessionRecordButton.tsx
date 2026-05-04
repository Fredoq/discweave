type DeleteSessionRecordButtonProps = {
  confirmationMessage: string
  onDelete: () => void
}

export function DeleteSessionRecordButton({
  confirmationMessage,
  onDelete,
}: DeleteSessionRecordButtonProps) {
  function handleDelete() {
    if (window.confirm(confirmationMessage)) {
      onDelete()
    }
  }

  return (
    <button
      className="button button-danger"
      type="button"
      onClick={handleDelete}
    >
      Delete session record
    </button>
  )
}
