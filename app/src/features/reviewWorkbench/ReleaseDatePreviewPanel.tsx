import {
  dateEvidenceLabel,
  type ReleaseDatePreview,
} from './releaseDateReviewApi'

export function ReleaseDatePreviewPanel({
  preview,
  busy,
  onApply,
}: Readonly<{
  preview: ReleaseDatePreview
  busy: boolean
  onApply: () => void
}>) {
  return (
    <section className="release-date-preview" aria-label="Date change preview">
      <h3>Compare editions</h3>
      <p>
        <strong>Your release: {preview.currentTitle}</strong>
        <br />
        {[
          preview.currentArtists.join(', '),
          preview.currentCatalogNumbers.join(', '),
          preview.currentLabels.join(', '),
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <h4>Discogs: {preview.title}</h4>
      <p>
        {[
          preview.artists.join(', '),
          preview.catalogNumber,
          preview.labels.join(', '),
          preview.formats.join(', '),
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <a href={preview.source.sourceUrl} target="_blank" rel="noreferrer">
        Discogs edition #{preview.source.externalId}
      </a>
      <p>{preview.source.attribution}</p>
      <dl>
        <dt>Current date</dt>
        <dd>{preview.currentDate || preview.currentYear || 'Not recorded'}</dd>
        <dt>Source date</dt>
        <dd>{dateEvidenceLabel(preview.date)}</dd>
      </dl>
      {preview.date?.kind === 'fullDate' && preview.token ? (
        <>
          <p>
            Confirm this is your edition. Only the release date and its year
            will change.
          </p>
          <button
            type="button"
            className="button button-primary"
            disabled={busy}
            onClick={onApply}
          >
            Apply date
          </button>
        </>
      ) : (
        <p>
          A complete date is not available for applying. Keep the existing
          precision; no day or month will be invented.
        </p>
      )}
    </section>
  )
}
