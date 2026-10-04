import { ArrowRight } from 'lucide-react'
import type { MouseEvent, RefObject, SyntheticEvent } from 'react'
import type { StackRelationTypeOption } from './trackStackModel'

type TrackStackDropChooserProps = Readonly<{
  canPromote: boolean
  dialogRef: RefObject<HTMLDialogElement | null>
  firstChoiceRef: RefObject<HTMLButtonElement | null>
  isSubmitting: boolean
  relationTypeOptions: readonly StackRelationTypeOption[]
  sourceTitle: string
  targetTitle: string
  onCancel: (event: SyntheticEvent<HTMLDialogElement>) => void
  onChooseRelation: (event: MouseEvent<HTMLButtonElement>) => void
  onClose: () => void
  onDismiss: () => void
  onPromote: (event: MouseEvent<HTMLButtonElement>) => void
}>

export function TrackStackDropChooser({
  canPromote,
  dialogRef,
  firstChoiceRef,
  isSubmitting,
  relationTypeOptions,
  sourceTitle,
  targetTitle,
  onCancel,
  onChooseRelation,
  onClose,
  onDismiss,
  onPromote,
}: TrackStackDropChooserProps) {
  return (
    <dialog
      aria-label="Add to stack as"
      className="track-stack-drop-chooser"
      onCancel={onCancel}
      onClose={onClose}
      ref={dialogRef}
    >
      <div className="track-stack-drop-copy">
        <span className="track-stack-drop-kicker">Add to stack</span>
        <strong>Choose relation type</strong>
        <span className="track-stack-drop-route">
          <span>
            <span>Source</span>
            <strong>{sourceTitle}</strong>
          </span>
          <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          <span>
            <span>Original</span>
            <strong>{targetTitle}</strong>
          </span>
        </span>
      </div>
      <fieldset className="track-stack-drop-actions">
        <legend className="visually-hidden">Stack relation type</legend>
        <div className="track-stack-drop-choice-list">
          {relationTypeOptions.map((option, index) => (
            <button
              className="track-stack-drop-choice-button"
              key={option.code}
              data-relation-type-code={option.code}
              disabled={isSubmitting}
              ref={index === 0 ? firstChoiceRef : undefined}
              type="button"
              onClick={onChooseRelation}
            >
              {option.label}
            </button>
          ))}
        </div>
        {canPromote ? (
          <fieldset className="track-stack-drop-promote">
            <legend>
              Or make <strong>{sourceTitle}</strong> the original. {targetTitle}{' '}
              becomes:
            </legend>
            <div className="track-stack-drop-choice-list">
              {relationTypeOptions.map((option) => (
                <button
                  aria-label={`Make original, ${targetTitle} as ${option.label}`}
                  className="track-stack-drop-choice-button"
                  key={option.code}
                  data-relation-type-code={option.code}
                  disabled={isSubmitting}
                  type="button"
                  onClick={onPromote}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}
        <button
          className="track-stack-drop-cancel"
          disabled={isSubmitting}
          type="button"
          onClick={onDismiss}
        >
          Cancel
        </button>
      </fieldset>
    </dialog>
  )
}
