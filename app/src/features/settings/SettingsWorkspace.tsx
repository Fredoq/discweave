import { useMemo, useState } from 'react'
import './settings.css'
import {
  defaultCatalogDictionaries,
  type CatalogDictionaries,
  type DiscogsIntegrationStatus,
  type DictionaryEntry,
  type DictionaryEntryRequest,
  type DictionaryEntryUpdateRequest,
  type DictionaryKind,
  type RatingCriterion,
  type RatingCriterionRequest,
  type RatingCriterionUpdateRequest,
} from '../catalog/catalogApi'
import { DiscogsIntegrationSettings } from './DiscogsIntegrationSettings'
import {
  DictionaryContextPanel,
  DictionaryCreatePanel,
  DictionaryEntryDetail,
  DictionaryTable,
  EmptyDetailPanel,
} from './DictionarySettingsPanels'
import { ImportPatternSettings } from './ImportPatternSettings'
import { NamingProfileSettings } from './NamingProfileSettings'
import { RatingCriteriaSettings } from './RatingCriteriaSettings'
import { TagRoleMappingSettings } from './TagRoleMappingSettings'
import { TrackRelationParserRulesSettings } from './TrackRelationParserRulesSettings'
import { dictionarySearchText, type SettingsMode } from './settingsModel'
import { SearchField, ViewModeSwitch } from './settingsShared'

export type SettingsWorkspaceProps = {
  dictionaries?: CatalogDictionaries
  onCreateEntry?: (entry: DictionaryEntryRequest) => void
  onUpdateEntry?: (entryId: string, entry: DictionaryEntryUpdateRequest) => void
  onDeleteEntry?: (entry: DictionaryEntry) => void
  onReplaceEntry?: (entry: DictionaryEntry, replacementCode: string) => void
  ratingCriteria?: RatingCriterion[]
  discogsIntegrationStatus?: DiscogsIntegrationStatus
  onCreateRatingCriterion?: (criterion: RatingCriterionRequest) => void
  onUpdateRatingCriterion?: (
    criterionId: string,
    criterion: RatingCriterionUpdateRequest,
  ) => void
  onDeleteRatingCriterion?: (criterion: RatingCriterion) => void
  onDiscogsIntegrationStatusChange?: (status: DiscogsIntegrationStatus) => void
}

export function SettingsWorkspace({
  dictionaries = defaultCatalogDictionaries,
  onCreateEntry,
  onUpdateEntry,
  onDeleteEntry,
  onReplaceEntry,
  ratingCriteria = [],
  discogsIntegrationStatus,
  onCreateRatingCriterion,
  onUpdateRatingCriterion,
  onDeleteRatingCriterion,
  onDiscogsIntegrationStatusChange,
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

  if (mode === 'namingProfiles') {
    return <NamingProfileSettings onModeChange={setMode} />
  }

  if (mode === 'tagRoleMappings') {
    return (
      <TagRoleMappingSettings
        dictionaries={dictionaries}
        onModeChange={setMode}
      />
    )
  }

  if (mode === 'trackRelationParserRules') {
    return (
      <TrackRelationParserRulesSettings
        dictionaries={dictionaries}
        onModeChange={setMode}
      />
    )
  }

  if (mode === 'integrations') {
    return (
      <DiscogsIntegrationSettings
        initialStatus={discogsIntegrationStatus}
        onModeChange={setMode}
        onStatusChange={onDiscogsIntegrationStatusChange}
      />
    )
  }

  return (
    <section className="catalog-layout" aria-label="Settings workspace">
      <div className="catalog-main">
        <SearchField
          placeholder="Dictionary entry, code, label, status, profile or mapping"
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
