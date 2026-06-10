import { useState } from 'react'
import { ManualEntryPanel } from '../manualEntry/ManualEntryPanel'
import {
  createManualRecordId,
  splitCommaList,
  textOrFallback,
} from '../manualEntry/manualEntryUtils'
import { type PlaylistRecord, type PlaylistType } from './playlistsData'

type PlaylistEntryFormProps = {
  initialPlaylist?: PlaylistRecord
  onCancel: () => void
  onSubmit: (playlist: PlaylistRecord) => void
}

export function PlaylistEntryForm({
  initialPlaylist,
  onCancel,
  onSubmit,
}: PlaylistEntryFormProps) {
  const [name, setName] = useState(initialPlaylist?.name ?? '')
  const [type, setType] = useState<PlaylistType>(
    initialPlaylist?.type ?? 'Manual',
  )
  const [description, setDescription] = useState(
    initialPlaylist?.description ?? '',
  )
  const [curator, setCurator] = useState(initialPlaylist?.curator ?? '')
  const [selectionNote, setSelectionNote] = useState(
    initialPlaylist?.type === 'Manual'
      ? initialPlaylist.manualSelection.note
      : (initialPlaylist?.smartRules.summary ?? ''),
  )
  const [criteria, setCriteria] = useState(
    initialPlaylist?.ruleHints.join(', ') ?? '',
  )
  const isValid = name.trim().length > 0
  const formTitle = initialPlaylist ? 'Edit playlist' : 'Add playlist'

  function handleSubmit() {
    const playlistName = name.trim()
    const ruleHints = splitCommaList(criteria)
    const baseRecord = {
      id: initialPlaylist?.id ?? createManualRecordId('playlist', playlistName),
      name: playlistName,
      description: textOrFallback(description, 'Manual playlist draft.'),
      curator: textOrFallback(curator, 'Default collection'),
      updatedAt: initialPlaylist?.updatedAt ?? 'Manual entry',
      yearRange: initialPlaylist?.yearRange ?? 'Not recorded',
      ruleHints,
      tracks: initialPlaylist?.tracks ?? [],
      linkedReleases: initialPlaylist?.linkedReleases ?? [],
      serverEntries: initialPlaylist?.serverEntries,
      serverRules: initialPlaylist?.serverRules,
    }

    if (type === 'Manual') {
      onSubmit({
        ...baseRecord,
        type,
        manualSelection: {
          source: 'Manual track selection',
          note: textOrFallback(
            selectionNote,
            'No manual selection note recorded.',
          ),
        },
      })
      return
    }

    onSubmit({
      ...baseRecord,
      type,
      smartRules: {
        summary: textOrFallback(
          selectionNote,
          'No smart rule summary recorded.',
        ),
        criteria: ruleHints.length > 0 ? ruleHints : ['No criteria recorded.'],
      },
    })
  }

  return (
    <ManualEntryPanel
      title={formTitle}
      requiredMessage="Name is required."
      isValid={isValid}
      onCancel={onCancel}
      onSubmit={handleSubmit}
      submitLabel={initialPlaylist ? 'Save record' : 'Add record'}
    >
      <label>
        <span>Name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>
      <label>
        <span>Type</span>
        <select
          value={type}
          onChange={(event) => setType(event.target.value as PlaylistType)}
        >
          <option>Manual</option>
          <option>Smart</option>
        </select>
      </label>
      <label>
        <span>Description</span>
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label>
        <span>Curator</span>
        <input
          value={curator}
          onChange={(event) => setCurator(event.target.value)}
        />
      </label>
      <label className="manual-entry-wide">
        <span>Rule or manual selection note</span>
        <textarea
          value={selectionNote}
          onChange={(event) => setSelectionNote(event.target.value)}
          rows={3}
        />
      </label>
      <label className="manual-entry-wide">
        <span>Tags/criteria</span>
        <input
          value={criteria}
          onChange={(event) => setCriteria(event.target.value)}
        />
      </label>
    </ManualEntryPanel>
  )
}
