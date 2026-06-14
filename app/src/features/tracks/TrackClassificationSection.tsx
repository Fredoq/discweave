type TrackClassificationSectionProps = Readonly<{
  genres: readonly string[]
  selectedGenres: readonly string[]
  tagsText: string
  onSelectedGenresChange: (genres: string[]) => void
  onTagsTextChange: (tagsText: string) => void
}>

export function TrackClassificationSection({
  genres,
  selectedGenres,
  tagsText,
  onSelectedGenresChange,
  onTagsTextChange,
}: TrackClassificationSectionProps) {
  return (
    <section className="release-form-section">
      <div className="release-form-section-header">
        <div>
          <h3>Classification</h3>
          <p>Genres and free-form tags.</p>
        </div>
      </div>
      <div className="genre-chip-list">
        {genres.map((genre) => (
          <label className="genre-chip" key={genre}>
            <input
              checked={selectedGenres.includes(genre)}
              type="checkbox"
              onChange={(event) =>
                onSelectedGenresChange(
                  event.target.checked
                    ? [...selectedGenres, genre]
                    : selectedGenres.filter(
                        (currentGenre) => currentGenre !== genre,
                      ),
                )
              }
            />
            <span>{genre}</span>
          </label>
        ))}
      </div>
      <label>
        <span>Tags</span>
        <input
          value={tagsText}
          onChange={(event) => onTagsTextChange(event.target.value)}
        />
      </label>
    </section>
  )
}
