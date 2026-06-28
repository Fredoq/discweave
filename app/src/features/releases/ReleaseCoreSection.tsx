import type { ReleaseRecord, ReleaseType } from './releasesData'
import { releaseYearOptions } from './ReleaseEntryFormTypes'

type ReleaseCoreSectionProps = {
  duplicateRelease?: ReleaseRecord
  releaseDate: string
  releaseTypeOptions: string[]
  setReleaseDate: (releaseDate: string) => void
  setTitle: (title: string) => void
  setType: (type: ReleaseType) => void
  setYear: (year: string) => void
  title: string
  type: ReleaseType
  year: string
}

export function ReleaseCoreSection({
  duplicateRelease,
  releaseDate,
  releaseTypeOptions,
  setReleaseDate,
  setTitle,
  setType,
  setYear,
  title,
  type,
  year,
}: ReleaseCoreSectionProps) {
  return (
    <>
      <section className="manual-entry-wide release-form-section release-core-section">
        <div className="release-form-section-header">
          <div>
            <h3>Core</h3>
            <p>Identify the logical release before adding copies.</p>
          </div>
        </div>
        <div className="release-core-grid">
          <label className="release-core-title-field">
            <span>Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>
          <label className="release-core-year-field">
            <span>Year</span>
            <select
              aria-label="Year"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            >
              <option value="">Not recorded</option>
              {releaseYearOptions.map((releaseYear) => (
                <option key={releaseYear}>{releaseYear}</option>
              ))}
            </select>
          </label>
          <label className="release-core-date-field">
            <span>Release date</span>
            <input
              aria-label="Release date"
              type="date"
              value={releaseDate}
              onChange={(event) => setReleaseDate(event.target.value)}
            />
          </label>
          <label className="release-core-type-field">
            <span>Type</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              {releaseTypeOptions.map((releaseType) => (
                <option key={releaseType}>{releaseType}</option>
              ))}
            </select>
          </label>
        </div>
      </section>
      {duplicateRelease ? (
        <p className="manual-entry-warning manual-entry-wide" role="status">
          Likely duplicate release: {duplicateRelease.title} by{' '}
          {duplicateRelease.artist}. Submit is still allowed for this session.
        </p>
      ) : null}
    </>
  )
}
