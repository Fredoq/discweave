import type { TrackReleaseAppearance } from './tracksData'

type TrackReleaseAppearancesSectionProps = Readonly<{
  appearances: readonly TrackReleaseAppearance[]
}>

export function TrackReleaseAppearancesSection({
  appearances,
}: TrackReleaseAppearancesSectionProps) {
  return (
    <aside className="track-entry-side">
      <div className="release-form-section-header">
        <div>
          <h3>Release appearances</h3>
          <p>Release-specific tracklist context.</p>
        </div>
      </div>
      {appearances.length > 0 ? (
        <div className="track-appearance-list">
          {appearances.map((appearance) => (
            <article
              className="track-appearance-card"
              key={`${appearance.releaseId}-${appearance.position}`}
            >
              <strong>{appearance.releaseTitle}</strong>
              <span className="track-appearance-position">
                Track {appearance.position}
              </span>
              <p>{appearance.releaseArtist}</p>
              <p>
                {appearance.year} · {appearance.label}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="release-section-note">
          This track is not attached to a release yet.
        </p>
      )}
    </aside>
  )
}
