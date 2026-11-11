import { useEffect, useId, useRef, useState } from 'react'
import type { CatalogDictionaries } from '../catalog/catalogApi'
import {
  catalogEntityHref,
  type CatalogLink,
  type CatalogLinkOption,
} from '../catalog/catalogLinks'
import { RelationEntryForm } from './RelationEntryForm'
import type { RelationRecord } from './relationsData'
import './relation-manager.css'

export type RelationMutationProps = {
  onAddRelation?: (relation: RelationRecord) => Promise<boolean>
  onUpdateRelation?: (relation: RelationRecord) => Promise<boolean>
  onDeleteRelation?: (id: string) => Promise<boolean>
}

type Props = RelationMutationProps & {
  context: CatalogLink
  name: string
  relations: RelationRecord[]
  linkOptions: CatalogLinkOption[]
  dictionaries: CatalogDictionaries
}

export function ContextualRelations(props: Props) {
  return (
    <ContextualRelationsContent
      key={`${props.context.kind}:${props.context.id}`}
      {...props}
    />
  )
}

function ContextualRelationsContent(props: Props) {
  const contextKey = `${props.context.kind}:${props.context.id}`
  const [openedContext, setOpenedContext] = useState<string | null>(null)
  if (
    !props.onAddRelation ||
    !props.onUpdateRelation ||
    !props.onDeleteRelation
  )
    return null
  return (
    <>
      <button
        type="button"
        className="button button-secondary"
        onClick={() => setOpenedContext(contextKey)}
      >
        Manage relationships
      </button>
      {openedContext === contextKey ? (
        <RelationManagerDialog
          key={`${props.context.kind}:${props.context.id}`}
          {...props}
          onClose={() => setOpenedContext(null)}
        />
      ) : null}
    </>
  )
}

export function RelationManagerDialog({
  context,
  name,
  relations,
  linkOptions,
  dictionaries,
  onAddRelation,
  onUpdateRelation,
  onDeleteRelation,
  onClose,
}: Props & { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const [editing, setEditing] = useState<RelationRecord | 'new' | null>(null)
  const [removing, setRemoving] = useState<RelationRecord | null>(null)
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const mountedRef = useRef(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const touchesContext = (relation: RelationRecord) =>
    relation.sourceLink?.kind === context.kind &&
    relation.targetLink?.kind === context.kind &&
    (relation.sourceLink.id === context.id ||
      relation.targetLink.id === context.id)
  const scoped = relations.filter(touchesContext)
  useEffect(() => {
    mountedRef.current = true
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const dialog = ref.current
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    closeRef.current?.focus()
    return () => {
      mountedRef.current = false
      if (dialog?.open && typeof dialog.close === 'function') dialog.close()
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  useEffect(() => {
    if (editing)
      ref.current
        ?.querySelector<HTMLElement>('form select:not(:disabled)')
        ?.focus()
  }, [editing])
  async function mutate(
    action: () => Promise<boolean>,
    operation: 'save' | 'remove' = 'save',
  ) {
    if (pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    setError('')
    setStatus('')
    const failure =
      operation === 'remove'
        ? 'The relationship could not be removed. Please try again.'
        : 'The relationship could not be saved. Your changes are still here.'
    try {
      const saved = await action()
      if (!mountedRef.current) return
      if (saved) {
        setEditing(null)
        setRemoving(null)
        setStatus(
          operation === 'remove'
            ? 'Relationship removed.'
            : 'Relationship saved.',
        )
        closeRef.current?.focus()
      } else setError(failure)
    } catch {
      if (mountedRef.current) setError(failure)
    } finally {
      pendingRef.current = false
      if (mountedRef.current) setPending(false)
    }
  }
  function save(relation: RelationRecord) {
    if (!touchesContext(relation)) {
      setError('The relationship must include this record.')
      return
    }
    const callback = editing === 'new' ? onAddRelation : onUpdateRelation
    if (callback) void mutate(() => callback(relation))
  }
  return (
    <dialog
      ref={ref}
      className="relation-manager-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!pendingRef.current) onClose()
      }}
    >
      <header className="relation-manager-header">
        <h2 id={titleId}>Relationships: {name}</h2>
        <button
          ref={closeRef}
          type="button"
          className="button button-secondary"
          disabled={pending}
          onClick={onClose}
        >
          Close relationships
        </button>
      </header>
      <p>
        Manage recorded connections. Removing a relationship does not delete
        either record.
      </p>
      {error ? <p role="alert">{error}</p> : null}
      <p role="status">{pending ? 'Saving relationship…' : status}</p>
      <fieldset disabled={pending} className="relation-manager-controls">
        {editing ? (
          <RelationEntryForm
            dictionaries={dictionaries}
            initialRelation={editing === 'new' ? undefined : editing}
            initialSourceLink={context}
            lockEndpoints={editing !== 'new'}
            lockSource
            linkOptions={linkOptions.filter(
              (option) => option.kind === context.kind,
            )}
            relations={relations}
            onCancel={() => {
              setEditing(null)
              setError('')
            }}
            onSubmit={save}
          />
        ) : removing ? (
          <section aria-label="Remove relationship">
            <p>
              Remove {removing.source} → {removing.target} (
              {removing.relationType})?
            </p>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setRemoving(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button-danger"
              onClick={() => {
                if (onDeleteRelation)
                  void mutate(() => onDeleteRelation(removing.id), 'remove')
              }}
            >
              Remove relationship
            </button>
          </section>
        ) : (
          <>
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                setEditing('new')
                setError('')
                setStatus('')
              }}
            >
              Add relationship
            </button>
            {scoped.length ? (
              <div className="relation-manager-table-scroll">
                <table className="relation-manager-table">
                  <thead>
                    <tr>
                      <th>From</th>
                      <th>Relationship</th>
                      <th>To</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoped.map((relation) => (
                      <tr key={relation.id}>
                        <td>
                          <a href={catalogEntityHref(relation.sourceLink!)}>
                            {relation.source}
                          </a>
                        </td>
                        <td>{relation.relationType}</td>
                        <td>
                          <a href={catalogEntityHref(relation.targetLink!)}>
                            {relation.target}
                          </a>
                        </td>
                        <td>
                          <div className="relation-manager-actions">
                            <button
                              type="button"
                              className="button button-secondary"
                              aria-label={`Edit relationship ${relation.source} to ${relation.target}`}
                              onClick={() => {
                                setEditing(relation)
                                setError('')
                                setStatus('')
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="button button-secondary"
                              aria-label={`Remove relationship ${relation.source} to ${relation.target}`}
                              onClick={() => {
                                setRemoving(relation)
                                setError('')
                                setStatus('')
                              }}
                            >
                              Remove
                            </button>
                            <a
                              href={`/relations?relation=${encodeURIComponent(relation.id)}`}
                            >
                              Relation record
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No recorded relationships for this record.</p>
            )}
          </>
        )}
      </fieldset>
    </dialog>
  )
}
