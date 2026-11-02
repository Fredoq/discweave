import type { ReleaseImportDraft } from '../catalog/catalogApi'
import { safeDiscogsUrl } from '../discover/discoverApi'
import { ReleaseImportCollectionItemIntentEditor } from './ReleaseImportCollectionItemIntentEditor'
import { draftValidationMessage } from './importHelpers'

export function RecommendedReleaseReview({
  draft,
  isPending,
  actionError,
  onChange,
  onConfirm,
  onSkip,
}: Readonly<{
  draft: ReleaseImportDraft
  isPending: boolean
  actionError: string | null
  onChange: (draft: ReleaseImportDraft) => void
  onConfirm: () => void
  onSkip: () => void
}>) {
  const intent = draft.collectionItemIntent
  const hasMedium = intent?.kind === 'newWanted' && Boolean(intent.medium)
  const validation = draftValidationMessage(draft)
  const source = draft.externalSources?.find(
    (item) =>
      item.providerCode === 'discogs' && item.resourceType === 'release',
  )
  const href = source
    ? safeDiscogsUrl(source.sourceUrl, source.externalId)
    : null
  const confirmed = draft.status === 'confirmed'

  return (
    <section
      className="panel section-panel"
      aria-label="Review recommended release"
    >
      <div className="panel-heading">
        <div>
          <h2>Review recommended release</h2>
          <p>
            Confirm this release and a Wanted medium. No files, catalog tracks
            or original-track links are created.
          </p>
        </div>
      </div>
      <h3>{draft.title}</h3>
      <p>
        {draft.artistNames.join(', ')}
        {draft.year ? ` · ${draft.year}` : ''}
      </p>
      {draft.labelName ? <p>{draft.labelName}</p> : null}
      {href ? (
        <p>
          <a href={href} target="_blank" rel="noreferrer">
            View verified release on Discogs
          </a>
        </p>
      ) : null}
      <p>
        Catalog metadata stays unchanged during this review and is revalidated
        before confirmation.
      </p>
      <h3>Release tracklist</h3>
      <ol>
        {draft.tracks.map((track) => (
          <li key={track.id}>{track.title}</li>
        ))}
      </ol>
      <fieldset
        disabled={isPending || confirmed}
        className="discover-review-medium"
        aria-label="Wanted medium"
      >
        <ReleaseImportCollectionItemIntentEditor
          wantedOnly
          intent={intent}
          onChange={(collectionItemIntent) =>
            onChange({ ...draft, collectionItemIntent })
          }
        />
      </fieldset>
      {actionError ? <p role="alert">{actionError}</p> : null}
      {validation ? <p className="imports-error">{validation}</p> : null}
      <div className="discover-actions">
        <button
          className="button button-primary"
          type="button"
          disabled={isPending || confirmed || !hasMedium || Boolean(validation)}
          onClick={onConfirm}
        >
          {confirmed ? 'Added to Wanted' : 'Review confirmation'}
        </button>
        <button
          className="button button-secondary"
          type="button"
          disabled={isPending || confirmed}
          onClick={onSkip}
        >
          Skip release
        </button>
      </div>
      <p className="discover-muted">Data provided by Discogs.</p>
    </section>
  )
}
