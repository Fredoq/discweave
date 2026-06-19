import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import type { LocalEditTags } from './localFileEditModel'
import {
  allTagFields,
  displayTagValue,
  embeddedTagValue,
  isTagWritable,
  normalizeTagList,
  numberInputValue,
  numberTagValue,
  scalarTagValue,
  stringInputValue,
} from './localFileEditHelpers'
import type { InspectState, LocalEditableFileDraft } from './localFileEditTypes'
import {
  listTagFields,
  numericTagFields,
  scalarTagFields,
  tagFieldLabel,
} from './localFileEditTypes'
import { TagChangeBadge, TagSupportBadge } from './LocalFileTagBadges'
import './local-file-tags.css'

export function TagEditMode({
  drafts,
  inspections,
  selectedRowId,
  tagChangesByRowId,
  tagUnchangedCount,
  tagUpdateCount,
  onAutofillTags,
  onSelectedRowChange,
  onTargetTagsChange,
}: {
  drafts: LocalEditableFileDraft[]
  inspections: Record<string, InspectState>
  selectedRowId: string
  tagChangesByRowId: Map<string, LocalEditTags>
  tagUnchangedCount: number
  tagUpdateCount: number
  onAutofillTags: (rowId?: string) => void
  onSelectedRowChange: (rowId: string) => void
  onTargetTagsChange: (rowId: string, targetTags: LocalEditTags) => void
}) {
  if (drafts.length === 1) {
    const draft = drafts[0]

    return (
      <div className="local-file-tag-single">
        <TagEditorDrawer
          draft={draft}
          inspection={inspections[draft.rowId]}
          tagChanges={tagChangesByRowId.get(draft.rowId) ?? {}}
          onAutofillTags={onAutofillTags}
          onTargetTagsChange={onTargetTagsChange}
        />
      </div>
    )
  }

  const selectedDraft =
    drafts.find((draft) => draft.rowId === selectedRowId) ?? drafts[0]
  const writableCount = drafts.filter((draft) =>
    isTagWritable(draft.currentPath),
  ).length

  return (
    <div className="local-file-tag-batch">
      <section className="local-file-edit-proposed" aria-label="Tag changes">
        <div className="local-file-edit-proposed-heading">
          <h3>Tag changes</h3>
          <div>
            <span>
              {tagUpdateCount} tag update / {tagUnchangedCount} unchanged
            </span>
          </div>
        </div>
        <div className="local-file-tag-bulk-strip">
          <div>
            <strong>Autofill target tags from catalog metadata</strong>
            <p>
              Fill all writable target tags from DiscWeave, then adjust
              individual tracks below.
            </p>
          </div>
          <button
            className="button button-secondary"
            disabled={writableCount === 0}
            type="button"
            onClick={() => onAutofillTags()}
          >
            Autofill all from DiscWeave
          </button>
        </div>
        <div className="local-file-edit-table-scroll">
          <table className="local-file-edit-change-table local-file-tag-table">
            <thead>
              <tr>
                <th>Track</th>
                <th>File</th>
                <th>Embedded title</th>
                <th>New title</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((draft) => (
                <TagBatchRow
                  draft={draft}
                  inspection={inspections[draft.rowId]}
                  isSelected={selectedDraft.rowId === draft.rowId}
                  key={draft.rowId}
                  tagChanges={tagChangesByRowId.get(draft.rowId) ?? {}}
                  onSelectedRowChange={onSelectedRowChange}
                  onAutofillTags={onAutofillTags}
                  onTargetTagsChange={onTargetTagsChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function TagBatchRow({
  draft,
  inspection,
  isSelected,
  tagChanges,
  onSelectedRowChange,
  onAutofillTags,
  onTargetTagsChange,
}: {
  draft: LocalEditableFileDraft
  inspection?: InspectState
  isSelected: boolean
  tagChanges: LocalEditTags
  onSelectedRowChange: (rowId: string) => void
  onAutofillTags: (rowId?: string) => void
  onTargetTagsChange: (rowId: string, targetTags: LocalEditTags) => void
}) {
  const tagWritable = isTagWritable(draft.currentPath)

  return (
    <>
      <tr
        aria-selected={isSelected}
        className={isSelected ? 'is-selected' : undefined}
      >
        <td>{draft.position}</td>
        <td>
          {draft.currentPath.slice(draft.currentPath.lastIndexOf('/') + 1)}
        </td>
        <td>{embeddedTagValue(inspection, 'title')}</td>
        <td>{displayTagValue(draft.targetTags.title)}</td>
        <td>
          <div className="local-file-tag-status-stack">
            <TagChangeBadge tagChanges={tagChanges} />
            <TagSupportBadge tagWritable={tagWritable} />
          </div>
        </td>
        <td>
          <button
            className="button button-secondary local-file-edit-row-action"
            type="button"
            onClick={() => onSelectedRowChange(draft.rowId)}
          >
            Edit tags
          </button>
        </td>
      </tr>
      {isSelected ? (
        <tr className="local-file-tag-expanded-row">
          <td colSpan={6}>
            <TagEditorInlineSection
              draft={draft}
              inspection={inspection}
              tagChanges={tagChanges}
              onAutofillTags={onAutofillTags}
              onTargetTagsChange={onTargetTagsChange}
            />
          </td>
        </tr>
      ) : null}
    </>
  )
}

function TagEditorDrawer({
  draft,
  inspection,
  tagChanges,
  onAutofillTags,
  onTargetTagsChange,
}: {
  draft: LocalEditableFileDraft
  inspection?: InspectState
  tagChanges: LocalEditTags
  onAutofillTags: (rowId?: string) => void
  onTargetTagsChange: (rowId: string, targetTags: LocalEditTags) => void
}) {
  const tagWritable = isTagWritable(draft.currentPath)
  const disabled = !tagWritable || inspection?.status !== 'loaded'

  return (
    <section
      className="local-file-tag-drawer"
      aria-label={`Tag editor for ${draft.title}`}
    >
      <div className="local-file-tag-drawer-heading">
        <div>
          <h3>{draft.title}</h3>
          <p>{draft.currentPath}</p>
        </div>
        <div className="local-file-tag-drawer-status">
          <TagSupportBadge tagWritable={tagWritable} />
          <TagChangeBadge tagChanges={tagChanges} />
        </div>
      </div>

      <div className="local-file-tag-columns">
        <TagEditorColumns
          disabled={disabled}
          draft={draft}
          inspection={inspection}
          tagWritable={tagWritable}
          onAutofillTags={onAutofillTags}
          onTargetTagsChange={onTargetTagsChange}
        />
      </div>
    </section>
  )
}

function TagEditorInlineSection({
  draft,
  inspection,
  tagChanges,
  onAutofillTags,
  onTargetTagsChange,
}: {
  draft: LocalEditableFileDraft
  inspection?: InspectState
  tagChanges: LocalEditTags
  onAutofillTags: (rowId?: string) => void
  onTargetTagsChange: (rowId: string, targetTags: LocalEditTags) => void
}) {
  const tagWritable = isTagWritable(draft.currentPath)
  const disabled = !tagWritable || inspection?.status !== 'loaded'

  return (
    <section
      className="local-file-tag-inline-editor"
      aria-label={`Tag editor for ${draft.title}`}
    >
      <div className="local-file-tag-inline-heading">
        <div>
          <h3>{draft.title}</h3>
          <p>{draft.currentPath}</p>
        </div>
        <div className="local-file-tag-drawer-status">
          <TagChangeBadge tagChanges={tagChanges} />
          <TagSupportBadge tagWritable={tagWritable} />
        </div>
      </div>
      <div className="local-file-tag-columns">
        <TagEditorColumns
          disabled={disabled}
          draft={draft}
          inspection={inspection}
          tagWritable={tagWritable}
          onAutofillTags={onAutofillTags}
          onTargetTagsChange={onTargetTagsChange}
        />
      </div>
    </section>
  )
}

function TagEditorColumns({
  disabled,
  draft,
  inspection,
  tagWritable,
  onAutofillTags,
  onTargetTagsChange,
}: {
  disabled: boolean
  draft: LocalEditableFileDraft
  inspection?: InspectState
  tagWritable: boolean
  onAutofillTags: (rowId?: string) => void
  onTargetTagsChange: (rowId: string, targetTags: LocalEditTags) => void
}) {
  return (
    <>
      <section aria-label="Current embedded tags">
        <h4>Current embedded tags</h4>
        <EmbeddedTagSummary
          inspection={inspection}
          targetTags={draft.targetTags}
        />
      </section>
      <section aria-label="New file tags">
        <div className="local-file-tag-section-heading">
          <h4>New file tags</h4>
          <button
            className="button button-secondary"
            disabled={!tagWritable}
            type="button"
            onClick={() => onAutofillTags(draft.rowId)}
          >
            Autofill from DiscWeave
          </button>
        </div>
        <TagEditorForm
          disabled={disabled}
          tags={draft.targetTags}
          onChange={(targetTags) => onTargetTagsChange(draft.rowId, targetTags)}
        />
      </section>
    </>
  )
}

function EmbeddedTagSummary({
  inspection,
  targetTags,
}: {
  inspection?: InspectState
  targetTags: LocalEditTags
}) {
  if (!inspection || inspection.status === 'loading') {
    return <p role="status">Inspecting file...</p>
  }

  if (inspection.status === 'failed') {
    return <p role="alert">{inspection.message}</p>
  }

  return (
    <dl className="detail-list local-file-tag-summary">
      {allTagFields(inspection.result.tags, targetTags).map((field) => (
        <div key={field}>
          <dt>{tagFieldLabel(field)}</dt>
          <dd>{displayTagValue(inspection.result.tags[field])}</dd>
        </div>
      ))}
    </dl>
  )
}

function TagEditorForm({
  disabled,
  onChange,
  tags,
}: {
  disabled: boolean
  onChange: (tags: LocalEditTags) => void
  tags: LocalEditTags
}) {
  return (
    <div className="local-file-tag-form">
      <div className="local-file-tag-form-grid">
        {scalarTagFields.map((field) => (
          <TextTagField
            disabled={disabled}
            field={field}
            key={field}
            tags={tags}
            onChange={onChange}
          />
        ))}
        {numericTagFields.map((field) => (
          <NumberTagField
            disabled={disabled}
            field={field}
            key={field}
            tags={tags}
            onChange={onChange}
          />
        ))}
      </div>
      <div className="local-file-tag-list-grid">
        {[...listTagFields, ...customTagFields(tags)].map((field) => (
          <TagListField
            disabled={disabled}
            field={field}
            key={field}
            tags={tags}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  )
}

function TextTagField({
  disabled,
  field,
  onChange,
  tags,
}: {
  disabled: boolean
  field: (typeof scalarTagFields)[number]
  onChange: (tags: LocalEditTags) => void
  tags: LocalEditTags
}) {
  return (
    <label className="local-file-edit-field">
      <span>{tagFieldLabel(field)}</span>
      <input
        aria-label={`New ${tagFieldLabel(field)}`}
        disabled={disabled}
        value={stringInputValue(tags[field])}
        onChange={(event) =>
          onChange({
            ...tags,
            [field]: scalarTagValue(event.currentTarget.value),
          })
        }
      />
    </label>
  )
}

function NumberTagField({
  disabled,
  field,
  onChange,
  tags,
}: {
  disabled: boolean
  field: (typeof numericTagFields)[number]
  onChange: (tags: LocalEditTags) => void
  tags: LocalEditTags
}) {
  return (
    <label className="local-file-edit-field">
      <span>{tagFieldLabel(field)}</span>
      <input
        aria-label={`New ${tagFieldLabel(field)}`}
        disabled={disabled}
        inputMode="numeric"
        min={0}
        type="number"
        value={numberInputValue(tags[field])}
        onChange={(event) =>
          onChange({
            ...tags,
            [field]: numberTagValue(event.currentTarget.value),
          })
        }
      />
    </label>
  )
}

function TagListField({
  disabled,
  field,
  onChange,
  tags,
}: {
  disabled: boolean
  field: string
  onChange: (tags: LocalEditTags) => void
  tags: LocalEditTags
}) {
  const [draftValue, setDraftValue] = useState('')
  const values = normalizeTagList(tags[field])

  function addValue() {
    const nextValue = draftValue.trim()
    if (!nextValue) {
      return
    }

    onChange({ ...tags, [field]: [...values, nextValue] })
    setDraftValue('')
  }

  return (
    <div className="local-file-tag-list-field">
      <span>{tagFieldLabel(field)}</span>
      <div className="local-file-tag-chip-editor">
        {values.map((value, index) => (
          <span className="local-file-tag-token" key={`${value}-${index}`}>
            {value}
            <button
              type="button"
              disabled={disabled}
              aria-label={`Remove ${value} from ${tagFieldLabel(field)}`}
              onClick={() =>
                onChange({
                  ...tags,
                  [field]: values.filter(
                    (_, valueIndex) => valueIndex !== index,
                  ),
                })
              }
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          aria-label={`New ${tagFieldLabel(field)} value`}
          disabled={disabled}
          value={draftValue}
          onChange={(event) => setDraftValue(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addValue()
            }
          }}
        />
        <button
          className="local-file-tag-add"
          type="button"
          disabled={disabled || draftValue.trim().length === 0}
          aria-label={`Add ${tagFieldLabel(field)}`}
          onClick={addValue}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}

function customTagFields(tags: LocalEditTags) {
  const knownFields = new Set<string>([
    ...scalarTagFields,
    ...numericTagFields,
    ...listTagFields,
  ])

  return Object.keys(tags).filter(
    (field) => !knownFields.has(field) && /^[A-Za-z0-9_.:-]{1,64}$/.test(field),
  )
}
