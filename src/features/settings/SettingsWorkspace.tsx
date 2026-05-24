import { useMemo, useState } from 'react'
import './settings.css'
import {
  defaultCatalogDictionaries,
  type CatalogDictionaries,
  type DictionaryEntry,
  type DictionaryEntryRequest,
  type DictionaryEntryUpdateRequest,
  type DictionaryKind,
  type RatingCriterion,
  type RatingCriterionRequest,
  type RatingCriterionUpdateRequest,
} from '../catalog/catalogApi'
import {
  DictionaryContextPanel,
  DictionaryCreatePanel,
  DictionaryEntryDetail,
  DictionaryTable,
  EmptyDetailPanel,
} from './DictionarySettingsPanels'
import { ImportPatternSettings } from './ImportPatternSettings'
import { RatingCriteriaSettings } from './RatingCriteriaSettings'
import { dictionarySearchText, type SettingsMode } from './settingsModel'
import { SearchField, ViewModeSwitch } from './settingsShared'

export type SettingsWorkspaceProps = {
  dictionaries?: CatalogDictionaries
  onCreateEntry?: (entry: DictionaryEntryRequest) => void
  onUpdateEntry?: (entryId: string, entry: DictionaryEntryUpdateRequest) => void
  onDeleteEntry?: (entry: DictionaryEntry) => void
  onReplaceEntry?: (entry: DictionaryEntry, replacementCode: string) => void
  ratingCriteria?: RatingCriterion[]
  onCreateRatingCriterion?: (criterion: RatingCriterionRequest) => void
  onUpdateRatingCriterion?: (
    criterionId: string,
    criterion: RatingCriterionUpdateRequest,
  ) => void
  onDeleteRatingCriterion?: (criterion: RatingCriterion) => void
}

export function SettingsWorkspace({
  dictionaries = defaultCatalogDictionaries,
  onCreateEntry,
  onUpdateEntry,
  onDeleteEntry,
  onReplaceEntry,
  ratingCriteria = [],
  onCreateRatingCriterion,
  onUpdateRatingCriterion,
  onDeleteRatingCriterion,
}: SettingsWorkspaceProps) {
  const [mode, setMode] = useState<SettingsMode>('dictionaries')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<DictionaryKind>('releaseType')
  const [selectedEntryId, setSelectedEntryId] = useState('')
  const queryTerms = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  )
  const entries = useMemo(
    () =>
      dictionaries[kind].filter((entry) => {
        const searchText = dictionarySearchText(entry)

        return queryTerms.every((term) => searchText.includes(term))
      }),
    [dictionaries, kind, queryTerms],
  )
  const selectedEntry =
    entries.find((entry) => entry.id === selectedEntryId) ?? entries[0] ?? null

  if (mode === 'ratings') {
    return (
      <RatingCriteriaSettings
        criteria={ratingCriteria}
        onCreateRatingCriterion={onCreateRatingCriterion}
        onDeleteRatingCriterion={onDeleteRatingCriterion}
        onModeChange={setMode}
        onUpdateRatingCriterion={onUpdateRatingCriterion}
      />
    )
  }

  if (mode === 'importPatterns') {
    return <ImportPatternSettings onModeChange={setMode} />
  }

  return (
    <section className="catalog-layout" aria-label="Settings workspace">
      <div className="catalog-main">
        <SearchField
          placeholder="Dictionary entry, code, label, status or profile"
          query={query}
          onQueryChange={setQuery}
        />
        <div className="settings-mode-row">
          <ViewModeSwitch mode={mode} onModeChange={setMode} />
        </div>
        <DictionaryContextPanel
          count={entries.length}
          kind={kind}
          onKindChange={(nextKind) => {
            setKind(nextKind)
            setSelectedEntryId('')
          }}
        />

        <DictionaryCreatePanel kind={kind} onCreateEntry={onCreateEntry} />
        <DictionaryTable
          entries={entries}
          selectedEntryId={selectedEntry?.id ?? ''}
          onSelectEntry={setSelectedEntryId}
        />
      </div>

      {selectedEntry ? (
        <DictionaryEntryDetail
          key={selectedEntry.id}
          dictionaries={dictionaries}
          entry={selectedEntry}
          onDeleteEntry={onDeleteEntry}
          onReplaceEntry={onReplaceEntry}
          onUpdateEntry={onUpdateEntry}
        />
      ) : (
        <EmptyDetailPanel />
      )}
    </section>
  )
}
