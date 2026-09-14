import type { ReactNode } from 'react'
import { useState } from 'react'
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
  groupDiscogsReviewCredits,
  hasCompilationTrackArtists,
} from './discogsRoleUtils'
import {
  buildDiscogsTrackMapping,
  discogsTrackMappingKey,
  isCompleteDiscogsTrackMapping,
  type DiscogsCurrentTrackForMapping,
  type DiscogsTrackMappingRow,
} from './discogsTrackMapping'
import { DiscogsTrackMappingReview } from './DiscogsTrackMappingReview'
import {
  DiscogsCandidateTrackImpact,
  DiscogsCreditImpactRow,
} from './DiscogsCandidateTrackImpact'

const unmatchedReason = {
  automatic: 'No safe automatic match',
  cleared: 'Imported file cleared',
  moved: 'Imported file moved to another Discogs track',
} as const
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
    keptTrackIds?: readonly string[],
    confirmedMappingKeys?: readonly string[],
  ) => boolean | void | Promise<boolean | void>
  onUpdateApplyGroup: (
    group: keyof DiscogsApplyGroups,
    checked: boolean,
  ) => void
}
type DiscogsMappingReviewState = {
  mapping: DiscogsTrackMappingRow[] | undefined
  confirmedMappingKeys: Set<string>
  keptTrackIds: Set<string>
}
export function DiscogsCandidateReview(
  props: Readonly<DiscogsCandidateReviewProps>,
) {
  const mappingContextKey = mappingContextKeyFor(
    props.detail,
    props.currentTracks,
  )
  return <DiscogsCandidateReviewContent {...props} key={mappingContextKey} />
}

function DiscogsCandidateReviewContent({
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
  const reviewTracks = discogsDraftTrackRows(detail.draft.tracklist)
  const draftGenres = detail.draft.genres ?? []
  const [mappingState, setMappingState] = useState<DiscogsMappingReviewState>(
    () => ({
      mapping: currentTracks
        ? buildDiscogsTrackMapping(currentTracks, detail.draft.tracklist)
        : undefined,
      confirmedMappingKeys: new Set(),
      keptTrackIds: new Set(),
    }),
  )
  const {
    mapping: trackMapping,
    confirmedMappingKeys,
    keptTrackIds,
  } = mappingState
  const appliedTracklist = trackMapping
    ? trackMapping
        .filter((row) => row.matchKind !== 'skipped')
        .map((row) => detail.draft.tracklist[row.discogsTrackIndex])
        .filter((track): track is ExternalMetadataReleaseDraftTrackDto =>
          Boolean(track),
        )
    : detail.draft.tracklist
  const compilationDetected = hasCompilationTrackArtists({
    ...detail,
    draft: {
      ...detail.draft,
      artistCredits: applyGroups.artists
        ? detail.draft.artistCredits
        : (current.artistCredits ?? []),
      tracklist: appliedTracklist,
    },
  })
  const mappingComplete = currentTracks
    ? isCompleteDiscogsTrackMapping(
        currentTracks,
        detail.draft.tracklist,
        trackMapping ?? [],
        [...keptTrackIds],
        [...confirmedMappingKeys],
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
            !confirmedMappingKeys.has(discogsTrackMappingKey(row))),
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
          fullWidthDetails
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
              keptTrackIds={keptTrackIds}
              mapping={trackMapping}
              onSelectTrack={(discogsTrackIndex, currentTrackId) => {
                const currentTrackIndex = currentTracks.findIndex(
                  (track) => track.id === currentTrackId,
                )
                setMappingState((state) => {
                  const nextConfirmedMappingKeys = new Set(
                    state.confirmedMappingKeys,
                  )
                  const nextKeptTrackIds = new Set(state.keptTrackIds)
                  if (currentTrackId) {
                    nextKeptTrackIds.delete(currentTrackId)
                  }
                  const nextMapping = state.mapping?.map((row) => {
                    if (row.discogsTrackIndex === discogsTrackIndex) {
                      nextConfirmedMappingKeys.delete(
                        discogsTrackMappingKey(row),
                      )

                      if (currentTrackId && currentTrackIndex >= 0) {
                        nextConfirmedMappingKeys.add(
                          discogsTrackMappingKey({
                            ...row,
                            currentTrackId,
                          }),
                        )
                        return {
                          ...row,
                          currentTrackId,
                          currentTrackIndex,
                          matchKind: 'review' as const,
                          reason: 'Manually selected imported file',
                        }
                      }

                      return unmatchedMappingRow(row, unmatchedReason.cleared)
                    }

                    if (
                      currentTrackId &&
                      row.currentTrackId === currentTrackId
                    ) {
                      nextConfirmedMappingKeys.delete(
                        discogsTrackMappingKey(row),
                      )
                      return unmatchedMappingRow(row, unmatchedReason.moved)
                    }

                    return row
                  })

                  return {
                    ...state,
                    mapping: nextMapping,
                    confirmedMappingKeys: nextConfirmedMappingKeys,
                    keptTrackIds: nextKeptTrackIds,
                  }
                })
              }}
              onConfirmMatch={(row) => {
                if (row.currentTrackId) {
                  setMappingState((state) => {
                    const nextKeys = new Set(state.confirmedMappingKeys)
                    nextKeys.add(discogsTrackMappingKey(row))
                    return { ...state, confirmedMappingKeys: nextKeys }
                  })
                }
              }}
              onKeepTrack={(currentTrackId) => {
                setMappingState((state) => {
                  const nextConfirmedMappingKeys = new Set(
                    state.confirmedMappingKeys,
                  )
                  const nextMapping = state.mapping?.map((row) => {
                    if (row.currentTrackId !== currentTrackId) {
                      return row
                    }

                    nextConfirmedMappingKeys.delete(discogsTrackMappingKey(row))
                    return unmatchedMappingRow(
                      row,
                      'Imported file kept unchanged',
                    )
                  })
                  return {
                    ...state,
                    mapping: nextMapping,
                    confirmedMappingKeys: nextConfirmedMappingKeys,
                    keptTrackIds: new Set([
                      ...state.keptTrackIds,
                      currentTrackId,
                    ]),
                  }
                })
              }}
              onUndoKeep={(currentTrackId) => {
                setMappingState((state) => {
                  const nextKeptTrackIds = new Set(state.keptTrackIds)
                  nextKeptTrackIds.delete(currentTrackId)
                  return { ...state, keptTrackIds: nextKeptTrackIds }
                })
              }}
              onSkipDiscogsRow={(discogsTrackIndex) => {
                setMappingState((state) => {
                  const nextConfirmedMappingKeys = new Set(
                    state.confirmedMappingKeys,
                  )
                  const nextMapping = state.mapping?.map((row) => {
                    if (row.discogsTrackIndex !== discogsTrackIndex) {
                      return row
                    }

                    nextConfirmedMappingKeys.delete(discogsTrackMappingKey(row))
                    return {
                      ...row,
                      currentTrackId: null,
                      currentTrackIndex: null,
                      matchKind: 'skipped' as const,
                      reason: 'Skipped by user',
                    }
                  })
                  return {
                    ...state,
                    mapping: nextMapping,
                    confirmedMappingKeys: nextConfirmedMappingKeys,
                  }
                })
              }}
              onRestoreDiscogsRow={(discogsTrackIndex) => {
                setMappingState((state) => ({
                  ...state,
                  mapping: state.mapping?.map((row) =>
                    row.discogsTrackIndex === discogsTrackIndex
                      ? unmatchedMappingRow(row, unmatchedReason.automatic)
                      : row,
                  ),
                }))
              }}
            />
          ) : (
            <DiscogsCandidateTrackImpact
              dictionaries={dictionaries}
              tracks={reviewTracks}
              trackImpactAction={trackImpactAction}
            />
          )}
        </ImpactRow>
      </div>
      {mappingBlocking ? (
        <p
          className="discogs-mapping-blocking-message"
          id="discogs-mapping-blocking-message"
          role="alert"
        >
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
        aria-describedby={
          mappingBlocking ? 'discogs-mapping-blocking-message' : undefined
        }
        onClick={() => {
          const result =
            trackMapping && applyGroups.tracklist
              ? keptTrackIds.size > 0
                ? onApplyDraft(
                    detail,
                    applyGroups,
                    trackMapping,
                    [...keptTrackIds],
                    [...confirmedMappingKeys],
                  )
                : onApplyDraft(detail, applyGroups, trackMapping, undefined, [
                    ...confirmedMappingKeys,
                  ])
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
function mappingContextKeyFor(
  detail: ExternalMetadataReleaseDetailDto,
  currentTracks: readonly DiscogsCurrentTrackForMapping[] | undefined,
) {
  return JSON.stringify([
    detail.source.externalId,
    currentTracks?.map(({ id, title, position }) => [id, title, position]),
    detail.draft.tracklist.map(({ title, position }) => [title, position]),
  ])
}
function unmatchedMappingRow(row: DiscogsTrackMappingRow, reason?: string) {
  return {
    ...row,
    currentTrackId: null,
    currentTrackIndex: null,
    matchKind: 'unmatched' as const,
    reason: reason ?? unmatchedReason.automatic,
  }
}
function mappingBlockingMessage(
  trackMapping: readonly DiscogsTrackMappingRow[] | undefined,
  confirmedMappingKeys: ReadonlySet<string>,
  currentTrackCount: number | undefined,
  discogsTrackCount: number,
) {
  const reviewCount =
    trackMapping?.filter(
      (row) =>
        row.matchKind === 'review' &&
        !confirmedMappingKeys.has(discogsTrackMappingKey(row)),
    ).length ?? 0
  const unmatchedCount =
    trackMapping?.filter((row) => row.matchKind === 'unmatched').length ?? 0

  if (reviewCount > 0 && unmatchedCount > 0) {
    return `Review ${reviewCount} track match${reviewCount === 1 ? '' : 'es'} and resolve ${unmatchedCount} unmatched track${unmatchedCount === 1 ? '' : 's'} to continue.`
  }

  if (reviewCount > 0) {
    return `Review ${reviewCount} track match${reviewCount === 1 ? '' : 'es'} to continue.`
  }

  if (unmatchedCount > 0) {
    return `Resolve ${unmatchedCount} unmatched track${unmatchedCount === 1 ? '' : 's'} to continue.`
  }

  if (
    currentTrackCount !== undefined &&
    currentTrackCount !== discogsTrackCount
  ) {
    return 'Map or keep every local track and resolve every Discogs row to continue.'
  }

  return 'Resolve the Discogs track mapping to continue.'
}

function ImpactRow({
  checked,
  children,
  currentValue,
  fullWidthDetails = false,
  group,
  nextValue,
  onChange,
}: Readonly<{
  checked: boolean
  children?: ReactNode
  currentValue: string
  fullWidthDetails?: boolean
  group: string
  nextValue: string
  onChange: (checked: boolean) => void
}>) {
  return (
    <div
      className={`discogs-impact-row${fullWidthDetails ? ' discogs-impact-row-with-details' : ''}`}
    >
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
        {children && !fullWidthDetails ? (
          <div className="discogs-impact-detail">{children}</div>
        ) : null}
      </div>
      {children && fullWidthDetails ? (
        <div className="discogs-impact-detail discogs-impact-detail-full">
          {children}
        </div>
      ) : null}
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
        <DiscogsCreditImpactRow
          credit={credit}
          dictionaries={dictionaries}
          key={credit.name}
        />
      ))}
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
