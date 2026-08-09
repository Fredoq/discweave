import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Link as LinkIcon,
} from 'lucide-react'
import type {
  ReleaseImportCollectionItemIntentDto,
  ReleaseImportDraft,
  ReleaseImportMediumIntentDto,
} from '../catalog/catalogApi'

type Props = Readonly<{
  actionError: string | null
  draft: ReleaseImportDraft
  isPending: boolean
  onChange: (draft: ReleaseImportDraft) => void
  onConfirm: () => void
  onEditDetails: () => void
}>

const mediumOptions = [
  ['digital', 'Digital'],
  ['vinyl', 'Vinyl'],
  ['cd', 'CD'],
  ['cassette', 'Cassette'],
  ['other', 'Other'],
] as const

export function ExternalOriginalReleaseReview({
  // NOSONAR: this review component coordinates the complete confirmation state.
  actionError,
  draft,
  isPending,
  onChange,
  onConfirm,
  onEditDetails,
}: Props) {
  const binding = draft.selectedOriginalBinding
  const originalTrack = binding
    ? draft.tracks.find((track) => track.id === binding.draftTrackId)
    : null
  const intent = draft.collectionItemIntent ?? {
    kind: 'newWanted' as const,
    medium: null,
  }
  const medium = intentMedium(intent)
  const discogsBacked = Boolean(
    binding?.releaseRoute.discogsRelease && binding.discogsRow,
  )
  const canConfirm =
    Boolean(binding && originalTrack && medium) &&
    (intent.kind === 'newWanted' || intent.ownedItemId.trim() !== '')

  function updateIntent(nextIntent: ReleaseImportCollectionItemIntentDto) {
    onChange({ ...draft, collectionItemIntent: nextIntent })
  }

  function changeIntent(kind: 'newWanted' | 'reuseExisting') {
    const currentMedium = medium ?? { kind: 'digital' as const }
    updateIntent(
      kind === 'newWanted'
        ? { kind, medium: currentMedium }
        : { kind, ownedItemId: '', expectedMedium: currentMedium },
    )
  }

  function changeMedium(kind: string) {
    const nextMedium = mediumForKind(kind, medium)
    if (!nextMedium) {
      return
    }
    updateIntent(
      intent.kind === 'newWanted'
        ? { ...intent, medium: nextMedium }
        : { ...intent, expectedMedium: nextMedium },
    )
  }

  return (
    <section
      aria-labelledby="external-original-review-heading"
      className="panel detail-panel imports-detail external-original-review"
    >
      <header className="external-original-review-header">
        <div>
          <p className="section-label">Original track discovery</p>
          <h2 id="external-original-review-heading">Review original release</h2>
          <p>
            Confirm the release and how it should be added to your collection.
          </p>
        </div>
      </header>

      <div className="external-original-review-body">
        <section className="external-original-track-summary">
          <div>
            <span>Selected original</span>
            <strong>
              {originalTrack?.title ?? 'Original track unavailable'}
            </strong>
            <small>{trackArtists(originalTrack?.artistNames ?? [])}</small>
          </div>
          <ArrowRight aria-hidden="true" size={18} />
          <div>
            <span>Relationship</span>
            <strong>Original version</strong>
            <small>The current track will be linked to this recording.</small>
          </div>
        </section>

        <section className="external-original-release-card">
          <div className="external-original-release-heading">
            <div>
              <span className="section-label">Release</span>
              <h3>{draft.title}</h3>
              <p>{releaseIdentity(draft)}</p>
            </div>
            <div
              aria-label="Metadata sources"
              className="external-original-provider-list"
            >
              {binding ? (
                <ProviderLink
                  href={binding.releaseRoute.musicBrainzRelease.sourceUrl}
                  label="MusicBrainz verified"
                />
              ) : null}
              {discogsBacked && binding?.releaseRoute.discogsRelease ? (
                <ProviderLink
                  href={binding.releaseRoute.discogsRelease.sourceUrl}
                  label="Discogs matched"
                />
              ) : (
                <span className="external-original-provider-status">
                  <CheckCircle2 aria-hidden="true" size={14} />
                  MusicBrainz only
                </span>
              )}
            </div>
          </div>
          <dl className="external-original-release-facts">
            <div>
              <dt>Track on release</dt>
              <dd>
                {trackLocation(originalTrack, binding?.discogsRow?.position)}
              </dd>
            </div>
            <div>
              <dt>Collection medium</dt>
              <dd>{medium ? mediumLabel(medium) : 'Choose a medium'}</dd>
            </div>
          </dl>
        </section>

        <fieldset className="external-original-intent">
          <legend>Add to collection</legend>
          <div className="external-original-intent-options">
            <label aria-label="Add to Wanted">
              <input
                checked={intent.kind === 'newWanted'}
                name="external-original-collection-intent"
                type="radio"
                value="newWanted"
                onChange={() => changeIntent('newWanted')}
              />
              <span>
                <strong>Add to Wanted</strong>
                <small>Create a wanted copy of this release.</small>
              </span>
            </label>
            <label aria-label="I own this release">
              <input
                checked={intent.kind === 'reuseExisting'}
                name="external-original-collection-intent"
                type="radio"
                value="reuseExisting"
                onChange={() => changeIntent('reuseExisting')}
              />
              <span>
                <strong>I own this release</strong>
                <small>Reuse an existing copy from your collection.</small>
              </span>
            </label>
          </div>

          <label className="settings-control external-original-medium-control">
            <span>Medium</span>
            <select
              name="external-original-medium"
              value={medium?.kind ?? ''}
              onChange={(event) => changeMedium(event.currentTarget.value)}
            >
              <option value="">Select medium</option>
              {mediumOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {medium?.kind === 'vinyl' && medium.formatDescription ? (
              <small>{medium.formatDescription}</small>
            ) : null}
          </label>

          {intent.kind === 'reuseExisting' && !intent.ownedItemId.trim() ? (
            <p className="external-original-owned-copy-note">
              Choose the owned copy in release details before confirming.
            </p>
          ) : null}
        </fieldset>

        <section className="external-original-outcome" aria-label="Outcome">
          <p>
            <CheckCircle2 aria-hidden="true" size={16} />
            {draft.localProvenanceSelection?.selectedReleaseId
              ? 'Reuse the matching release in your catalog.'
              : 'Create this release in your catalog.'}
          </p>
          <p>
            <CheckCircle2 aria-hidden="true" size={16} />
            {draft.localProvenanceSelection?.selectedTrackId
              ? 'Reuse the matching original track.'
              : 'Create the selected original track.'}
          </p>
          <p>
            <LinkIcon aria-hidden="true" size={16} />
            Link the current track to its original version.
          </p>
        </section>

        {actionError ? (
          <p className="imports-error" role="alert">
            {actionError}
          </p>
        ) : null}

        <button
          className="external-original-edit-link"
          type="button"
          onClick={onEditDetails}
        >
          Edit release details
        </button>
      </div>

      <footer className="external-original-review-footer">
        <button
          className="button button-primary"
          disabled={!canConfirm || isPending}
          type="button"
          onClick={onConfirm}
        >
          {isPending ? 'Confirming original release' : confirmLabel(intent)}
        </button>
      </footer>
    </section>
  )
}

function ProviderLink({
  href,
  label,
}: Readonly<{ href: string; label: string }>) {
  return (
    <a
      className="external-original-provider-status"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      <CheckCircle2 aria-hidden="true" size={14} />
      {label}
      <ExternalLink aria-hidden="true" size={12} />
    </a>
  )
}

function intentMedium(intent: ReleaseImportCollectionItemIntentDto) {
  return intent.kind === 'newWanted' ? intent.medium : intent.expectedMedium
}

function mediumForKind(
  kind: string,
  current: ReleaseImportMediumIntentDto | null,
): ReleaseImportMediumIntentDto | null {
  switch (kind) {
    case 'digital':
      return { kind }
    case 'vinyl':
      return {
        kind,
        formatDescription:
          current?.kind === 'vinyl' && current.formatDescription
            ? current.formatDescription
            : 'Vinyl',
      }
    case 'cd':
      return { kind, discCount: 1 }
    case 'cassette':
      return { kind, tapeType: 'Cassette' }
    case 'other':
      return { kind, name: 'Other' }
    default:
      return null
  }
}

function releaseIdentity(draft: ReleaseImportDraft) {
  const label = draft.labels?.[0]?.name ?? draft.labelName
  const catalogNumber = draft.labels?.[0]?.catalogNumber ?? draft.catalogNumber
  return [draft.year ?? draft.releaseDate, label, catalogNumber]
    .filter(Boolean)
    .join(' · ')
}

function trackArtists(artists: string[]) {
  return artists.length > 0 ? artists.join(', ') : 'Artist unavailable'
}

function trackLocation(
  track: ReleaseImportDraft['tracks'][number] | null | undefined,
  discogsPosition: string | null | undefined,
) {
  const position =
    discogsPosition?.trim() ||
    track?.side?.trim() ||
    (track?.position ? String(track.position) : '—')
  const duration = formatDuration(track?.durationSeconds)
  return [`Track ${position}`, duration].filter(Boolean).join(' · ')
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds < 0) {
    return ''
  }
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

function mediumLabel(medium: ReleaseImportMediumIntentDto) {
  switch (medium.kind) {
    case 'digital':
      return 'Digital'
    case 'vinyl':
      return ['Vinyl', medium.formatDescription].filter(Boolean).join(' · ')
    case 'cd':
      return `CD · ${medium.discCount} ${medium.discCount === 1 ? 'disc' : 'discs'}`
    case 'cassette':
      return ['Cassette', medium.tapeType].filter(Boolean).join(' · ')
    case 'other':
      return medium.name || 'Other'
  }
}

function confirmLabel(intent: ReleaseImportCollectionItemIntentDto) {
  return intent.kind === 'newWanted'
    ? 'Add to Wanted and link original'
    : 'Use owned copy and link original'
}
