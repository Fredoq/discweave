import type { KeyboardEvent, RefObject } from 'react'
import { LoaderCircle } from 'lucide-react'
import { formatDurationSeconds } from '../catalog/durationFormat'
import { confidenceLabel } from './originalTrackDiscoveryModel'
import {
  candidateOriginLabel,
  isLocalDiscoveryCandidate,
  presentOriginalCandidates,
  type OriginalTrackDiscoveryCandidate,
} from './originalTrackDiscoveryPresentation'
import {
  presentOriginalReleaseCandidates,
  type OriginalReleaseCandidate,
} from './originalTrackDiscoveryReleaseCandidates'
import type { OriginalTrackDiscoveryController } from './useOriginalTrackDiscovery'

type CandidateStepProps = Readonly<{
  controller: OriginalTrackDiscoveryController
  candidatePaneRef: RefObject<HTMLElement | null>
}>

export function OriginalTrackDiscoveryCandidates({
  // NOSONAR: candidate presentation coordinates release, local, and deep-search states.
  controller,
  candidatePaneRef,
}: CandidateStepProps) {
  const { state } = controller
  const showCandidates = state.status === 'loaded' || state.status === 'empty'
  const releases = presentOriginalReleaseCandidates(state.releaseCandidates)
  const collectionCandidates = presentOriginalCandidates(
    state.localCandidates,
    [],
  )
  const deepCandidates = presentOriginalCandidates(
    [],
    state.deepCandidates,
  ).filter(isActionableCandidate)
  const showReleaseSearch = state.externalStatus === 'loading'
  const showDeepSearch = state.deepSearchStatus !== 'idle'
  const canSearchDeeper =
    state.externalStatus === 'loaded' || state.externalStatus === 'failed'
  const deepSearchButtonLabel = deepSearchLabel(state.deepSearchStatus)

  return (
    <section className="original-track-discovery-body">
      {showCandidates ? (
        <fieldset className="original-track-discovery-candidates">
          <legend>Choose an original track</legend>
          <section
            aria-label="Ranked original-track candidates"
            className="original-track-discovery-candidate-scroll"
            ref={candidatePaneRef}
            onScroll={(event) =>
              controller.setCandidateScrollOffset(event.currentTarget.scrollTop)
            }
          >
            {showReleaseSearch ? (
              <SearchPlaceholder
                detail="Checking MusicBrainz and Discogs for concrete editions."
                title="Searching releases…"
              />
            ) : (
              <ReleaseResults controller={controller} releases={releases} />
            )}

            {collectionCandidates.length > 0 ? (
              <CandidateGroup
                candidates={collectionCandidates}
                controller={controller}
                label="Collection candidates"
              />
            ) : null}

            {canSearchDeeper ? (
              <section className="original-track-discovery-deep-search">
                <div>
                  <strong>Not the release you expected?</strong>
                  <span>
                    Search recording relationships and shared works for less
                    direct matches.
                  </span>
                </div>
                <button
                  className="button button-secondary"
                  disabled={state.deepSearchStatus === 'loading'}
                  type="button"
                  onClick={() => void controller.searchDeeper()}
                >
                  {state.deepSearchStatus === 'loading' ? (
                    <LoaderCircle aria-hidden="true" size={15} />
                  ) : null}
                  {deepSearchButtonLabel}
                </button>
              </section>
            ) : null}

            {showDeepSearch ? (
              <DeepSearchResults
                candidates={deepCandidates}
                controller={controller}
                status={state.deepSearchStatus}
              />
            ) : null}
          </section>
        </fieldset>
      ) : (
        <div
          aria-hidden="true"
          className="original-track-discovery-candidate-placeholder"
        />
      )}
    </section>
  )
}

function ReleaseResults({
  controller,
  releases,
}: Readonly<{
  controller: OriginalTrackDiscoveryController
  releases: readonly OriginalReleaseCandidate[]
}>) {
  const providerRetryCodes = retryableProviderCodes(controller)
  return (
    <section
      aria-label="Release candidates"
      className="original-track-discovery-result-group"
    >
      <ResultHeading count={releases.length} title="Release candidates" />
      {releases.length > 0 ? (
        <div className="original-track-discovery-release-list">
          {releases.map((release) => (
            <ReleaseCard
              checked={
                controller.state.selectedExternalRouteKey === release.routeKey
              }
              key={release.releaseKey}
              release={release}
              selectRelease={controller.selectReleaseCandidate}
            />
          ))}
        </div>
      ) : (
        <div className="original-track-discovery-empty">
          <strong>No concrete release found yet</strong>
          <span>
            You can run a deeper track search or retry a source that did not
            complete.
          </span>
          {providerRetryCodes.map((providerCode) => (
            <button
              className="button button-secondary"
              key={providerCode}
              type="button"
              onClick={() => void controller.retryProvider(providerCode)}
            >
              Retry {providerLabel(providerCode)}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function DeepSearchResults({
  candidates,
  controller,
  status,
}: Readonly<{
  candidates: readonly OriginalTrackDiscoveryCandidate[]
  controller: OriginalTrackDiscoveryController
  status: 'idle' | 'loading' | 'loaded' | 'failed'
}>) {
  if (status === 'loading') {
    return (
      <SearchPlaceholder
        detail="Following recording relationships and shared works. Quick release results remain available above."
        title="Searching deeper…"
      />
    )
  }

  return (
    <CandidateGroup
      candidates={candidates}
      controller={controller}
      emptyMessage="No additional recording candidates found."
      label="Deep search results"
    />
  )
}

function deepSearchLabel(status: 'idle' | 'loading' | 'loaded' | 'failed') {
  switch (status) {
    case 'loading':
      return 'Searching deeper…'
    case 'loaded':
      return 'Search deeper again'
    default:
      return 'Search deeper'
  }
}

function ReleaseCard({
  checked,
  release,
  selectRelease,
}: Readonly<{
  checked: boolean
  release: OriginalReleaseCandidate
  selectRelease: (candidateKey: string, routeKey: string) => boolean
}>) {
  const inputId = `original-release-candidate-${release.releaseKey}`
  const detailsId = `${inputId}-details`
  const editionMetadata = [
    release.artists.join(', ') || null,
    release.dateLabel,
    ...release.formats,
    ...release.labels,
    release.catalogNumber,
  ].filter(Boolean)
  const trackMetadata = [
    release.trackPosition ? `Track ${release.trackPosition}` : null,
    release.trackTitle,
    release.trackDurationSeconds == null
      ? null
      : formatDurationSeconds(release.trackDurationSeconds),
  ].filter(Boolean)

  return (
    <article className="original-track-discovery-release-card">
      <input
        aria-label={[
          release.title,
          release.trackTitle,
          release.artists.join(', '),
        ]
          .filter(Boolean)
          .join(' · ')}
        aria-describedby={detailsId}
        checked={checked}
        id={inputId}
        name="original-track-candidate"
        type="radio"
        onChange={() => selectRelease(release.candidateKey, release.routeKey)}
        onKeyDown={(event) =>
          selectRadioOnEnter(event, () =>
            selectRelease(release.candidateKey, release.routeKey),
          )
        }
      />
      <label htmlFor={inputId}>
        <strong>{release.title}</strong>
      </label>
      <div className="original-track-discovery-release-card-sources">
        {release.discogsSourceUrl ? (
          <a href={release.discogsSourceUrl}>Discogs</a>
        ) : null}
        {release.releaseSourceUrl !== release.discogsSourceUrl ? (
          <a href={release.releaseSourceUrl}>MusicBrainz</a>
        ) : null}
      </div>
      <div
        className="original-track-discovery-release-card-details"
        id={detailsId}
      >
        <p>{editionMetadata.join(' · ')}</p>
        {trackMetadata.length > 0 ? <p>{trackMetadata.join(' · ')}</p> : null}
      </div>
    </article>
  )
}

function CandidateGroup({
  candidates,
  controller,
  emptyMessage,
  label,
}: Readonly<{
  candidates: readonly OriginalTrackDiscoveryCandidate[]
  controller: OriginalTrackDiscoveryController
  emptyMessage?: string
  label: string
}>) {
  return (
    <section
      aria-label={label}
      className="original-track-discovery-result-group"
    >
      <ResultHeading count={candidates.length} title={label} />
      {candidates.length > 0 ? (
        <div className="original-track-discovery-candidate-list">
          {candidates.map((candidate) => (
            <CandidateCard
              candidate={candidate}
              checked={
                controller.state.selectedCandidateKey === candidate.candidateKey
              }
              key={candidate.candidateKey}
              selectCandidate={controller.selectCandidate}
            />
          ))}
        </div>
      ) : (
        <p className="original-track-discovery-deep-empty">{emptyMessage}</p>
      )}
    </section>
  )
}

function ResultHeading({
  count,
  title,
}: Readonly<{ count: number; title: string }>) {
  return (
    <div className="original-track-discovery-results-heading">
      <span>{title}</span>
      <strong>
        {count} {count === 1 ? 'result' : 'results'}
      </strong>
    </div>
  )
}

function SearchPlaceholder({
  detail,
  title,
}: Readonly<{ detail: string; title: string }>) {
  return (
    <div className="original-track-discovery-search-placeholder">
      <LoaderCircle aria-hidden="true" size={22} />
      <span>
        <strong>{title}</strong>
        <span>{detail}</span>
      </span>
    </div>
  )
}

type CandidateCardProps = Readonly<{
  candidate: OriginalTrackDiscoveryCandidate
  checked: boolean
  selectCandidate: (candidateKey: string) => boolean
}>

function CandidateCard({
  candidate,
  checked,
  selectCandidate,
}: CandidateCardProps) {
  const inputId = `original-track-candidate-${candidate.candidateKey}`
  return (
    <article
      className="original-track-discovery-candidate"
      data-confidence={candidate.confidence}
    >
      <div className="original-track-discovery-candidate-heading">
        <input
          aria-describedby={`${inputId}-meta`}
          checked={checked}
          id={inputId}
          name="original-track-candidate"
          type="radio"
          value={candidate.candidateKey}
          onChange={() => selectCandidate(candidate.candidateKey)}
          onKeyDown={(event) =>
            selectRadioOnEnter(event, () =>
              selectCandidate(candidate.candidateKey),
            )
          }
        />
        <label htmlFor={inputId}>
          <span>
            <strong>{candidate.title}</strong>
            <span>{candidate.artistDisplay}</span>
          </span>
          <span
            className="original-track-discovery-confidence"
            data-confidence={candidate.confidence}
          >
            {confidenceLabel(candidate.confidence)}
          </span>
        </label>
      </div>
      <div
        className="original-track-discovery-candidate-meta"
        id={`${inputId}-meta`}
      >
        <span>{visibleOriginLabel(candidate)}</span>
        {candidate.durationSeconds == null ? null : (
          <span>{formatDurationSeconds(candidate.durationSeconds)}</span>
        )}
        {candidate.earliestKnownDate ? (
          <span>
            earliest known release:{' '}
            <time dateTime={candidate.earliestKnownDate.value}>
              {candidate.earliestKnownDate.value}
            </time>
          </span>
        ) : null}
        <span>{candidateRootState(candidate)}</span>
      </div>
    </article>
  )
}

function selectRadioOnEnter(
  event: KeyboardEvent<HTMLInputElement>,
  select: () => void,
) {
  if (event.key === 'Enter' && !event.currentTarget.disabled) {
    event.preventDefault()
    select()
  }
}

function candidateRootState(candidate: OriginalTrackDiscoveryCandidate) {
  if (!isLocalDiscoveryCandidate(candidate)) {
    return candidate.kind === 'combined'
      ? 'Matched local recording'
      : 'External recording candidate'
  }
  if (!candidate.isExistingRoot) return 'Standalone local track'
  return `${candidate.memberCount} ${
    candidate.memberCount === 1 ? 'stack member' : 'stack members'
  }`
}

function visibleOriginLabel(candidate: OriginalTrackDiscoveryCandidate) {
  const label = candidateOriginLabel(candidate.origins)
  return label === 'Local' ? 'Local origin' : label
}

function isActionableCandidate(candidate: OriginalTrackDiscoveryCandidate) {
  return (
    isLocalDiscoveryCandidate(candidate) ||
    candidate.localCandidate !== null ||
    (candidate.externalCandidate?.releaseRoutes.length ?? 0) > 0
  )
}

function retryableProviderCodes(controller: OriginalTrackDiscoveryController) {
  const retryable = new Set([
    'rateLimited',
    'timeout',
    'unavailable',
    'invalidResponse',
  ])
  const codes = controller.state.providerStatuses
    .filter((status) => retryable.has(status.outcome))
    .map((status) => status.providerCode)
  if (controller.state.externalStatus === 'failed' && codes.length === 0) {
    codes.push('musicbrainz')
  }
  return [...new Set(codes)]
}

function providerLabel(providerCode: string) {
  switch (providerCode.toLowerCase()) {
    case 'musicbrainz':
      return 'MusicBrainz'
    case 'discogs':
      return 'Discogs'
    default:
      return providerCode
  }
}
