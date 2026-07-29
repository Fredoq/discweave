import type { KeyboardEvent, RefObject, SyntheticEvent } from 'react'
import type {
  OriginalCandidateEvidenceChannel,
  OriginalCandidateEvidenceCode,
  OriginalCandidateEvidenceDto,
} from '../catalog/api/catalogDtoTypes'
import { formatDurationSeconds } from '../catalog/durationFormat'
import { confidenceLabel, evidenceGroups } from './originalTrackDiscoveryModel'
import {
  candidateOriginLabel,
  isLocalDiscoveryCandidate,
  type OriginalTrackDiscoveryCandidate,
} from './originalTrackDiscoveryPresentation'
import type { OriginalTrackDiscoveryController } from './useOriginalTrackDiscovery'

type CandidateStepProps = Readonly<{
  controller: OriginalTrackDiscoveryController
  candidatePaneRef: RefObject<HTMLDivElement | null>
}>

export function OriginalTrackDiscoveryCandidates({
  controller,
  candidatePaneRef,
}: CandidateStepProps) {
  const { state } = controller
  const showCandidates = state.status === 'loaded' || state.status === 'empty'

  return (
    <section className="original-track-discovery-body">
      {showCandidates ? (
        <fieldset className="original-track-discovery-candidates">
          <legend>Choose an original track</legend>
          {state.status === 'empty' ? (
            <p className="original-track-discovery-empty">
              No reliable candidate found
            </p>
          ) : null}
          <div
            aria-label="Ranked original-track candidates"
            className="original-track-discovery-candidate-scroll"
            ref={candidatePaneRef}
            role="region"
            onScroll={(event) =>
              controller.setCandidateScrollOffset(event.currentTarget.scrollTop)
            }
          >
            <div className="original-track-discovery-candidate-list">
              {state.candidates.map((candidate) => (
                <CandidateCard
                  candidate={candidate}
                  checked={
                    state.selectedCandidateKey === candidate.candidateKey
                  }
                  expandedKeys={state.expandedEvidenceKeys}
                  key={candidate.candidateKey}
                  selectCandidate={controller.selectCandidate}
                  setExpandedEvidenceKeys={controller.setExpandedEvidenceKeys}
                />
              ))}
            </div>
          </div>
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

type CandidateCardProps = Readonly<{
  candidate: OriginalTrackDiscoveryCandidate
  checked: boolean
  expandedKeys: readonly string[]
  selectCandidate: (candidateKey: string) => boolean
  setExpandedEvidenceKeys: (keys: string[]) => void
}>

function CandidateCard({
  candidate,
  checked,
  expandedKeys,
  selectCandidate,
  setExpandedEvidenceKeys,
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
          disabled={!candidate.selectable}
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
        ) : (
          <span>earliest known release: unknown</span>
        )}
        <span>{candidateRootState(candidate)}</span>
      </div>
      <div className="original-track-discovery-evidence">
        {evidenceGroups(candidate).map((group) => {
          const evidenceKey = `${candidate.candidateKey}:${group.key}`
          return (
            <details
              className="original-track-discovery-evidence-group"
              data-kind={group.key}
              key={evidenceKey}
              open={expandedKeys.includes(evidenceKey)}
              onToggle={(event) =>
                updateExpandedEvidence(
                  event,
                  evidenceKey,
                  expandedKeys,
                  setExpandedEvidenceKeys,
                )
              }
            >
              <summary
                onKeyDown={(event) =>
                  toggleEvidenceOnKey(
                    event,
                    evidenceKey,
                    expandedKeys,
                    setExpandedEvidenceKeys,
                  )
                }
              >
                {group.label} for {candidate.title}
                <span aria-hidden="true">{group.items.length}</span>
              </summary>
              {group.items.length > 0 ? (
                <ul>
                  {group.items.map((item, index) => (
                    <EvidenceItem
                      item={item}
                      key={`${item.code}:${item.channel}:${index}`}
                    />
                  ))}
                </ul>
              ) : (
                <p>No {group.label.toLowerCase()}</p>
              )}
            </details>
          )
        })}
      </div>
    </article>
  )
}

function EvidenceItem({
  item,
}: Readonly<{ item: OriginalCandidateEvidenceDto }>) {
  return (
    <li>
      <span className="original-track-discovery-evidence-kind">
        {evidenceKindLabel(item.code)}
      </span>
      <span>{evidenceChannelLabel(item.channel)}</span>
    </li>
  )
}

function updateExpandedEvidence(
  event: SyntheticEvent<HTMLDetailsElement>,
  evidenceKey: string,
  expandedKeys: readonly string[],
  setExpandedEvidenceKeys: (keys: string[]) => void,
) {
  const wasExpanded = expandedKeys.includes(evidenceKey)
  if (event.currentTarget.open === wasExpanded) return
  const next = new Set(expandedKeys)
  if (event.currentTarget.open) next.add(evidenceKey)
  else next.delete(evidenceKey)
  setExpandedEvidenceKeys([...next])
}

function toggleEvidenceOnKey(
  event: KeyboardEvent<HTMLElement>,
  evidenceKey: string,
  expandedKeys: readonly string[],
  setExpandedEvidenceKeys: (keys: string[]) => void,
) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  const next = new Set(expandedKeys)
  if (next.has(evidenceKey)) next.delete(evidenceKey)
  else next.add(evidenceKey)
  setExpandedEvidenceKeys([...next])
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

function evidenceChannelLabel(channel: OriginalCandidateEvidenceChannel) {
  switch (channel) {
    case 'localCatalog':
      return 'Local catalog'
    case 'musicBrainz':
      return 'Attached recording metadata'
    case 'discogs':
      return 'Attached release metadata'
  }
}

function evidenceKindLabel(code: OriginalCandidateEvidenceCode) {
  return evidenceLabels[code]
}

const evidenceLabels: Record<OriginalCandidateEvidenceCode, string> = {
  directedLineage: 'Directed lineage',
  knownLocalRoot: 'Known local original root',
  identityMatch: 'Identity match',
  versionMarker: 'Version marker',
  earlierChronology: 'Earlier chronology',
  closeDuration: 'Close duration',
  creditsSupport: 'Credits support',
  laterChronology: 'Later chronology',
  artistMismatch: 'Artist mismatch',
  materialDurationMismatch: 'Material duration mismatch',
  incompatibleVersionMarker: 'Incompatible version marker',
  incompleteChronology: 'Incomplete chronology',
  uncertainWorkMapping: 'Uncertain work mapping',
  missingArtist: 'Missing artist',
  missingChronology: 'Missing chronology',
  missingDuration: 'Missing duration',
  missingVersionMarker: 'Missing version marker',
}
