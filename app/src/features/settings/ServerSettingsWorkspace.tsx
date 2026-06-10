import { useEffect, useState } from 'react'
import {
  CatalogApiError,
  defaultCatalogDictionaries,
  loadRatingCriteria,
  loadSettingsDictionaries,
  type CatalogDictionaries,
  type DictionaryEntry,
  type DictionaryEntryRequest,
  type DictionaryEntryUpdateRequest,
  type RatingCriterion,
  type RatingCriterionRequest,
  type RatingCriterionUpdateRequest,
} from '../catalog/catalogApi'
import { SettingsWorkspace } from './SettingsWorkspace'

type ServerSettingsWorkspaceProps = {
  onCreateEntry: (entry: DictionaryEntryRequest) => void
  onUpdateEntry: (entryId: string, entry: DictionaryEntryUpdateRequest) => void
  onDeleteEntry: (entry: DictionaryEntry) => void
  onReplaceEntry: (entry: DictionaryEntry, replacementCode: string) => void
  onCreateRatingCriterion: (criterion: RatingCriterionRequest) => void
  onUpdateRatingCriterion: (
    criterionId: string,
    criterion: RatingCriterionUpdateRequest,
  ) => void
  onDeleteRatingCriterion: (criterion: RatingCriterion) => void
  onSessionExpired: () => void
  searchRefreshKey: number
}

export function ServerSettingsWorkspace({
  onCreateEntry,
  onUpdateEntry,
  onDeleteEntry,
  onReplaceEntry,
  onCreateRatingCriterion,
  onUpdateRatingCriterion,
  onDeleteRatingCriterion,
  onSessionExpired,
  searchRefreshKey,
}: ServerSettingsWorkspaceProps) {
  const [dictionaries, setDictionaries] = useState<CatalogDictionaries>(
    defaultCatalogDictionaries,
  )
  const [ratingCriteria, setRatingCriteria] = useState<RatingCriterion[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let isCurrent = true

    queueMicrotask(() => {
      if (!isCurrent) {
        return
      }

      setStatus('loading')
      setError('')
    })

    void Promise.all([loadSettingsDictionaries(), loadRatingCriteria()])
      .then(([loadedDictionaries, loadedRatingCriteria]) => {
        if (!isCurrent) {
          return
        }

        setDictionaries(loadedDictionaries)
        setRatingCriteria(loadedRatingCriteria)
        setStatus('ready')
      })
      .catch((requestError: unknown) => {
        if (!isCurrent) {
          return
        }

        if (
          requestError instanceof CatalogApiError &&
          requestError.status === 401
        ) {
          onSessionExpired()
          return
        }

        setStatus('error')
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Settings could not be loaded.',
        )
      })

    return () => {
      isCurrent = false
    }
  }, [onSessionExpired, retryKey, searchRefreshKey])

  if (status === 'loading') {
    return (
      <section className="panel section-panel" aria-live="polite">
        <div className="panel-heading">
          <div>
            <h2>Settings</h2>
            <p role="status">Loading settings…</p>
          </div>
        </div>
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="panel section-panel" aria-live="polite">
        <div className="panel-heading">
          <div>
            <h2>Settings unavailable</h2>
            <p role="alert">{error}</p>
          </div>
        </div>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => {
            setStatus('loading')
            setError('')
            setRetryKey((key) => key + 1)
          }}
        >
          Retry
        </button>
      </section>
    )
  }

  return (
    <SettingsWorkspace
      dictionaries={dictionaries}
      onCreateEntry={onCreateEntry}
      onDeleteEntry={onDeleteEntry}
      onReplaceEntry={onReplaceEntry}
      onUpdateEntry={onUpdateEntry}
      ratingCriteria={ratingCriteria}
      onCreateRatingCriterion={onCreateRatingCriterion}
      onDeleteRatingCriterion={onDeleteRatingCriterion}
      onUpdateRatingCriterion={onUpdateRatingCriterion}
    />
  )
}
