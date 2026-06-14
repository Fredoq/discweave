import { isEmptyVersionNote } from './trackDisplayHelpers'
import type { TrackReleaseAppearance } from './tracksData'

type TrackReleaseAppearancesSectionProps = {
  appearances: TrackReleaseAppearance[]
  onVersionNoteChange: (index: number, nextValue: string) => void
}

export function TrackReleaseAppearancesSection({
  appearances,
  onVersionNoteChange,
}: TrackReleaseAppearancesSectionProps) {
  return (
    <aside className="track-entry-side">
      <div className="release-form-section-header">
        <div>
          <h3>Release appearances</h3>
          <p>Release-specific version notes and tracklist context.</p>
        </div>
      </div>
      {appearances.length > 0 ? (
        <div className="track-appearance-list">
          {appearances.map((appearance, index) => (
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
              <label className="track-appearance-version-field">
                <span>Version note</span>
                <input
                  placeholder="Album version, radio edit, remix..."
                  value={
                    isEmptyVersionNote(appearance.versionNote)
                      ? ''
                      : appearance.versionNote
                  }
                  onChange={(event) =>
                    onVersionNoteChange(index, event.target.value)
                  }
                />
              </label>
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
