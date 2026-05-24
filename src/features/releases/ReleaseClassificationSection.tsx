import type { Dispatch, SetStateAction } from 'react'

type ReleaseClassificationSectionProps = {
  genreOptions: string[]
  genres: string[]
  setGenres: Dispatch<SetStateAction<string[]>>
  setTags: Dispatch<SetStateAction<string>>
  tags: string
}

export function ReleaseClassificationSection({
  genreOptions,
  genres,
  setGenres,
  setTags,
  tags,
}: ReleaseClassificationSectionProps) {
  return (
    <section className="manual-entry-wide release-form-section">
      <div className="release-form-section-header">
        <div>
          <h3>Classification</h3>
          <p>Genres are broad filters; tags can stay free-form.</p>
        </div>
      </div>
      <fieldset className="genre-chip-fieldset">
        <legend>Genres</legend>
        <div className="genre-chip-list">
          {genreOptions.map((genre) => (
            <label className="genre-chip" key={genre}>
              <input
                aria-label={`Genre ${genre}`}
                type="checkbox"
                checked={genres.includes(genre)}
                onChange={(event) =>
                  setGenres((currentGenres) =>
                    event.target.checked
                      ? [...currentGenres, genre]
                      : currentGenres.filter((value) => value !== genre),
                  )
                }
              />
              <span>{genre}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        <span>Tags</span>
        <input value={tags} onChange={(event) => setTags(event.target.value)} />
      </label>
    </section>
  )
}
