import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import type {
  CatalogDictionaries,
  ExternalMetadataReleaseDetailDto,
  ExternalMetadataReleaseDraftTrackDto,
} from '../catalog/catalogApi'
import { discogsDraftTrackRows } from './discogsReleaseTrackRows'
import type {
  DiscogsApplyGroups,
  DiscogsCurrentRelease,
} from './DiscogsReleaseLookupPanel'
import {
  discogsRoleLabelFromCode,
  groupDiscogsReviewCredits,
  hasCompilationTrackArtists,
  type GroupedDiscogsReviewCredit,
} from './discogsRoleUtils'
import {
  buildDiscogsTrackMapping,
  type DiscogsCurrentTrackForMapping,
  type DiscogsTrackMappingRow,
} from './discogsTrackMapping'
import { DiscogsTrackMappingReview } from './DiscogsTrackMappingReview'

type DiscogsCandidateReviewProps = {
  applyGroups: DiscogsApplyGroups
  current: DiscogsCurrentRelease
  detail: ExternalMetadataReleaseDetailDto
  dictionaries: CatalogDictionaries
  hasSelectedGroup: boolean
  isApplying?: boolean
  trackImpactAction?: string
  currentTracks?: readonly DiscogsCurrentTrackForMapping[]
  onApplyDraft: (
    detail: ExternalMetadataReleaseDetailDto,
    groups: DiscogsApplyGroups,
    trackMapping?: readonly DiscogsTrackMappingRow[],
  ) => boolean | void | Promise<boolean | void>
  onUpdateApplyGroup: (
    group: keyof DiscogsApplyGroups,
    checked: boolean,
  ) => void
}

type DiscogsMappingReviewState = {
  contextKey: string
  mapping: DiscogsTrackMappingRow[] | undefined
  confirmedMappingKeys: Set<string>
}

export function DiscogsCandidateReview({
  applyGroups,
  current,
  detail,
  dictionaries,
  hasSelectedGroup,
  isApplying = false,
  trackImpactAction = 'create track',
  currentTracks,
  onApplyDraft,
  onUpdateApplyGroup,
}: Readonly<DiscogsCandidateReviewProps>) {
  const compilationDetected = hasCompilationTrackArtists(detail)
  const reviewTracks = discogsDraftTrackRows(detail.draft.tracklist)
  const draftGenres = detail.draft.genres ?? []
  const mappingContextKey = [
    detail.source.externalId,
    currentTracks?.map((t) => t.id + t.title + t.position).join(),
    detail.draft.tracklist
      .map((t) => t.title + t.position + t.disc + t.side)
      .join(),
  ].join('::')
  const automaticMapping = currentTracks
    ? buildDiscogsTrackMapping(currentTracks, detail.draft.tracklist)
    : undefined
  const [mappingState, setMappingState] = useState<DiscogsMappingReviewState>(
    () => ({
      contextKey: mappingContextKey,
      mapping: automaticMapping,
      confirmedMappingKeys: new Set(),
    }),
  )

  useEffect(() => {
    if (mappingState.contextKey === mappingContextKey) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset editable mapping on prop changes
    setMappingState({
      contextKey: mappingContextKey,
      mapping: automaticMapping,
      confirmedMappingKeys: new Set(),
    })
  }, [automaticMapping, mappingContextKey, mappingState.contextKey])

  const { mapping: trackMapping, confirmedMappingKeys } = mappingState

  const mappingComplete = currentTracks
    ? isCompleteMapping(
        currentTracks,
        detail.draft.tracklist,
        trackMapping ?? [],
      )
    : true
  const mappingBlocking = Boolean(
    applyGroups.tracklist &&
    currentTracks &&
    (!mappingComplete ||
      trackMapping?.some(
        (row) =>
          row.matchKind === 'unmatched' ||
          (row.matchKind === 'review' &&
            !confirmedMappingKeys.has(mappingKey(row))),
      )),
  )

  return (
    <div className="discogs-review-panel">
      <div className="release-form-section-header">
        <div>
          <h3>Review Discogs candidate</h3>
          <p>
            {detail.source.attribution}{' '}
            <a
              className="detail-link"
              href={detail.source.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Discogs source
            </a>
          </p>
        </div>
      </div>

      <div className="discogs-impact-list">
        <ImpactRow
          checked={applyGroups.core}
          currentValue={[
            current.title || 'Not recorded',
            current.releaseDate || current.year,
          ]
            .filter(Boolean)
            .join(' · ')}
          group="Core"
          nextValue={[
            detail.draft.title,
            detail.draft.releaseDate || detail.draft.year?.toString(),
          ]
            .filter(Boolean)
            .join(' · ')}
          onChange={(checked) => onUpdateApplyGroup('core', checked)}
        />
        <ImpactRow
          checked={applyGroups.artists}
          currentValue={current.artists || 'Not recorded'}
          group="Artists"
          nextValue={`${detail.draft.artistCredits.length} Discogs credits`}
          onChange={(checked) => onUpdateApplyGroup('artists', checked)}
        >
          <ArtistImpactList
            credits={detail.draft.artistCredits}
            dictionaries={dictionaries}
          />
        </ImpactRow>
        <ImpactRow
          checked={applyGroups.labels}
          currentValue={current.labels || 'Not recorded'}
          group="Labels"
          nextValue={releaseLabelSummary(detail) || 'Not recorded'}
          onChange={(checked) => onUpdateApplyGroup('labels', checked)}
        />
        <ImpactRow
          checked={applyGroups.classification}
          currentValue={current.genres || 'Not recorded'}
          group="Classification"
          nextValue={
            draftGenres.length > 0 ? draftGenres.join(', ') : 'Not recorded'
          }
          onChange={(checked) => onUpdateApplyGroup('classification', checked)}
        />
        <ImpactRow
          checked={applyGroups.tracklist}
          currentValue={`${current.trackCount} rows`}
          group="Tracklist"
          nextValue={`${reviewTracks.length} Discogs rows`}
          onChange={(checked) => onUpdateApplyGroup('tracklist', checked)}
        >
          {compilationDetected ? (
            <p className="discogs-impact-warning">
              Compilation detected: track-specific artists differ from release
              artists. Applying Tracklist will mark the release as Various
              Artists and write track-level artist credits.
            </p>
          ) : null}
          {currentTracks && trackMapping ? (
            <DiscogsTrackMappingReview
              confirmedMappingKeys={confirmedMappingKeys}
              currentTracks={currentTracks}
              discogsTracks={detail.draft.tracklist}
              mapping={trackMapping}
              onSelectTrack={(discogsTrackIndex, currentTrackId) => {
                const currentTrackIndex = currentTracks.findIndex(
                  (track) => track.id === currentTrackId,
                )

                setMappingState((state) => {
                  const nextConfirmedMappingKeys = new Set(
                    state.confirmedMappingKeys,
                  )
                  const nextMapping = state.mapping?.map((row) => {
                    if (row.discogsTrackIndex === discogsTrackIndex) {
                      nextConfirmedMappingKeys.delete(mappingKey(row))

                      if (currentTrackId && currentTrackIndex >= 0) {
                        nextConfirmedMappingKeys.add(
                          `${discogsTrackIndex}:${currentTrackId}`,
                        )
                        return {
                          ...row,
                          currentTrackId,
                          currentTrackIndex,
                          matchKind: 'review' as const,
                          reason: 'Manually selected imported file',
                        }
                      }

                      return unmatchedMappingRow(row)
                    }

                    if (
                      currentTrackId &&
                      row.currentTrackId === currentTrackId
                    ) {
                      nextConfirmedMappingKeys.delete(mappingKey(row))
                      return unmatchedMappingRow(row)
                    }

                    return row
                  })

                  return {
                    ...state,
                    mapping: nextMapping,
                    confirmedMappingKeys: nextConfirmedMappingKeys,
                  }
                })
              }}
              onConfirmMatch={(row) => {
                if (row.currentTrackId) {
                  setMappingState((state) => {
                    const nextKeys = new Set(state.confirmedMappingKeys)
                    nextKeys.add(mappingKey(row))
                    return { ...state, confirmedMappingKeys: nextKeys }
                  })
                }
              }}
            />
          ) : (
            <TrackImpactList
              dictionaries={dictionaries}
              tracks={reviewTracks}
              trackImpactAction={trackImpactAction}
            />
          )}
        </ImpactRow>
      </div>

      {mappingBlocking ? (
        <p className="discogs-mapping-blocking-message">
          {mappingBlockingMessage(
            trackMapping,
            confirmedMappingKeys,
            currentTracks?.length,
            detail.draft.tracklist.length,
          )}
        </p>
      ) : null}

      <button
        className="button button-primary button-compact"
        type="button"
        disabled={!hasSelectedGroup || isApplying || mappingBlocking}
        onClick={() => {
          const result = trackMapping
            ? onApplyDraft(detail, applyGroups, trackMapping)
            : onApplyDraft(detail, applyGroups)
          if (result instanceof Promise) {
            result.catch(() => undefined)
          }
        }}
      >
        {isApplying
          ? 'Linking Discogs release…'
          : 'Apply selected Discogs fields'}
      </button>
    </div>
  )
}

function mappingKey(row: DiscogsTrackMappingRow) {
  return `${row.discogsTrackIndex}:${row.currentTrackId}`
}

function unmatchedMappingRow(row: DiscogsTrackMappingRow) {
  return {
    ...row,
    currentTrackId: null,
    currentTrackIndex: null,
    matchKind: 'unmatched' as const,
    reason: 'No safe automatic match',
  }
}

function isCompleteMapping(
  currentTracks: readonly DiscogsCurrentTrackForMapping[],
  discogsTracks: readonly ExternalMetadataReleaseDraftTrackDto[],
  mapping: readonly DiscogsTrackMappingRow[],
) {
  if (
    currentTracks.length !== discogsTracks.length ||
    mapping.length !== currentTracks.length
  ) {
    return false
  }

  const currentIds = new Set(currentTracks.map((track) => track.id))
  const mappedCurrentIds = new Set(
    mapping.flatMap((row) => (row.currentTrackId ? [row.currentTrackId] : [])),
  )
  const mappedDiscogsIndexes = new Set(
    mapping.map((row) => row.discogsTrackIndex),
  )

  return (
    currentIds.size === currentTracks.length &&
    mappedCurrentIds.size === currentTracks.length &&
    [...mappedCurrentIds].every((id) => currentIds.has(id)) &&
    mappedDiscogsIndexes.size === discogsTracks.length &&
    [...mappedDiscogsIndexes].every(
      (index) => index >= 0 && index < discogsTracks.length,
    )
  )
}

function mappingBlockingMessage(
  trackMapping: readonly DiscogsTrackMappingRow[] | undefined,
  confirmedMappingKeys: ReadonlySet<string>,
  currentTrackCount: number | undefined,
  discogsTrackCount: number,
) {
  if (
    currentTrackCount !== undefined &&
    currentTrackCount !== discogsTrackCount
  ) {
    return 'Imported and Discogs track counts must match. Uncheck Apply Tracklist to apply other fields.'
  }

  const reviewCount =
    trackMapping?.filter(
      (row) =>
        row.matchKind === 'review' &&
        !confirmedMappingKeys.has(mappingKey(row)),
    ).length ?? 0
  const unmatchedCount =
    trackMapping?.filter((row) => row.matchKind === 'unmatched').length ?? 0

  if (reviewCount > 0 && unmatchedCount > 0) {
    return `Review ${reviewCount} track match${reviewCount === 1 ? '' : 'es'} and resolve ${unmatchedCount} unmatched track${unmatchedCount === 1 ? '' : 's'} to continue.`
  }

  if (reviewCount > 0) {
    return `Review ${reviewCount} track match${reviewCount === 1 ? '' : 'es'} to continue.`
  }

  return `Resolve ${unmatchedCount} unmatched track${unmatchedCount === 1 ? '' : 's'} to continue.`
}

function ImpactRow({
  checked,
  children,
  currentValue,
  group,
  nextValue,
  onChange,
}: Readonly<{
  checked: boolean
  children?: ReactNode
  currentValue: string
  group: string
  nextValue: string
  onChange: (checked: boolean) => void
}>) {
  return (
    <div className="discogs-impact-row">
      <ApplyGroup
        checked={checked}
        label={`Apply ${group}`}
        onChange={onChange}
      />
      <div className="discogs-impact-group">{group}</div>
      <div className="discogs-impact-value">
        <span>Current</span>
        <strong>{currentValue}</strong>
      </div>
      <div className="discogs-impact-value">
        <span>Discogs</span>
        <strong>{nextValue}</strong>
        {children ? (
          <div className="discogs-impact-detail">{children}</div>
        ) : null}
      </div>
    </div>
  )
}

function ArtistImpactList({
  credits,
  dictionaries,
}: Readonly<{
  credits: ExternalMetadataReleaseDetailDto['draft']['artistCredits']
  dictionaries: CatalogDictionaries
}>) {
  if (credits.length === 0) {
    return <p className="discogs-impact-empty">No Discogs artist credits.</p>
  }

  return (
    <div className="discogs-credit-impact-list">
      {groupDiscogsReviewCredits(credits).map((credit) => (
        <CreditImpactRow
          credit={credit}
          dictionaries={dictionaries}
          key={credit.name}
        />
      ))}
    </div>
  )
}

function TrackImpactList({
  dictionaries,
  tracks,
  trackImpactAction,
}: Readonly<{
  dictionaries: CatalogDictionaries
  tracks: ExternalMetadataReleaseDraftTrackDto[]
  trackImpactAction: string
}>) {
  const [showAllTracks, setShowAllTracks] = useState(false)
  const previewTracks = showAllTracks ? tracks : tracks.slice(0, 4)
  const hiddenCount = tracks.length - previewTracks.length

  if (tracks.length === 0) {
    return <p className="discogs-impact-empty">No Discogs track rows.</p>
  }

  let trackToggle: ReactNode = null
  if (hiddenCount > 0) {
    trackToggle = (
      <button
        className="button button-secondary button-compact discogs-track-toggle"
        type="button"
        aria-expanded={showAllTracks}
        onClick={() => setShowAllTracks(true)}
      >
        Show {hiddenCount} more Discogs track row
        {hiddenCount === 1 ? '' : 's'}
      </button>
    )
  } else if (showAllTracks && tracks.length > 4) {
    trackToggle = (
      <button
        className="button button-secondary button-compact discogs-track-toggle"
        type="button"
        aria-expanded={showAllTracks}
        onClick={() => setShowAllTracks(false)}
      >
        Show fewer Discogs track rows
      </button>
    )
  }

  return (
    <div className="discogs-track-impact-list">
      {previewTracks.map((track, index) => {
        const trackContext = discogsTrackContext(track)
        const trackKey = `${track.disc ?? ''}-${track.side ?? ''}-${track.position}-${track.title}-${index}`

        return (
          <div className="discogs-track-impact-row" key={trackKey}>
            <span className="discogs-track-impact-position">
              {track.position}
            </span>
            <div>
              <strong>{track.title}</strong>
              <p>
                {[trackContext, trackDurationLabel(track), trackImpactAction]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {track.artistCredits.length > 0 ? (
                <div className="discogs-credit-impact-list">
                  {groupDiscogsReviewCredits(track.artistCredits).map(
                    (credit) => (
                      <CreditImpactRow
                        credit={credit}
                        dictionaries={dictionaries}
                        key={`${trackKey}-${credit.name}`}
                      />
                    ),
                  )}
                </div>
              ) : (
                <p className="discogs-impact-empty">
                  Inherits release artists.
                </p>
              )}
            </div>
          </div>
        )
      })}
      {trackToggle}
    </div>
  )
}

function discogsTrackContext(track: ExternalMetadataReleaseDraftTrackDto) {
  return [
    track.disc?.trim(),
    track.side?.trim() ? `Side ${track.side.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

function trackDurationLabel(track: ExternalMetadataReleaseDraftTrackDto) {
  return track.durationSeconds
    ? formatDurationSeconds(track.durationSeconds)
    : 'No duration'
}

function CreditImpactRow({
  credit,
  dictionaries,
}: Readonly<{
  credit: GroupedDiscogsReviewCredit
  dictionaries: CatalogDictionaries
}>) {
  return (
    <div className="discogs-credit-impact-row">
      <strong>{credit.name}</strong>
      <span className="discogs-credit-role-list">
        {credit.roles.map((role) => (
          <span className="badge badge-credit" key={role}>
            {discogsRoleLabelFromCode(role, dictionaries)}
          </span>
        ))}
      </span>
    </div>
  )
}

function ApplyGroup({
  checked,
  label,
  onChange,
}: Readonly<{
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}>) {
  return (
    <label className="compact-checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

function releaseLabelSummary(detail: ExternalMetadataReleaseDetailDto) {
  return detail.draft.labels
    .map((label) => [label.name, label.catalogNumber].filter(Boolean).join(' '))
    .join(', ')
}

function formatDurationSeconds(durationSeconds: number) {
  const minutes = Math.floor(durationSeconds / 60)
  const seconds = durationSeconds % 60

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
