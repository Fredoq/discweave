import { useId } from 'react'
import {
  candidateDateLabel,
  type useCandidateReleaseDates,
} from './useCandidateReleaseDates'
import type { useReleaseDateSearch } from './useReleaseDateSearch'

type Props = Readonly<{
  search: ReturnType<typeof useReleaseDateSearch>
  dates: ReturnType<typeof useCandidateReleaseDates>
  busy: boolean
  onEdit: () => void
  onSearch: (broad: boolean) => void
  onSelect: (id: string) => void
}>
export function ReleaseDateSearch({
  search,
  dates,
  busy,
  onEdit,
  onSearch,
  onSelect,
}: Props) {
  const catalogOptions = useId()
  const canSearch = Boolean(
    (search.title.trim() && search.artist.trim()) ||
    search.catalogNumber.trim(),
  )
  return (
    <section aria-label="Find this edition">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSearch(false)
        }}
      >
        <label>
          <span>Release title</span>
          <input
            value={search.title}
            disabled={busy}
            onChange={(event) => {
              search.edit('title', event.target.value)
              onEdit()
            }}
          />
        </label>
        <label>
          <span>Main artist</span>
          <input
            value={search.artist}
            disabled={busy}
            onChange={(event) => {
              search.edit('artist', event.target.value)
              onEdit()
            }}
          />
        </label>
        <label>
          <span>Catalog number</span>
          <input
            value={search.catalogNumber}
            list={catalogOptions}
            disabled={busy}
            onChange={(event) => {
              search.edit('catalogNumber', event.target.value)
              onEdit()
            }}
          />
          <datalist id={catalogOptions}>
            {search.context.catalogNumbers.map((number) => (
              <option key={number} value={number} />
            ))}
          </datalist>
        </label>
        <div className="release-date-search-actions">
          <button
            type="submit"
            className="button button-secondary"
            disabled={busy || search.loading || !canSearch}
          >
            Find matching editions
          </button>
          <button
            type="button"
            className="button button-secondary"
            disabled={busy || search.loading || !search.title.trim()}
            onClick={() => onSearch(true)}
          >
            Broaden to title only
          </button>
        </div>
      </form>
      {search.loading && (
        <p>
          <output>Loading release details…</output>
        </p>
      )}
      {search.loadError && <p role="alert">{search.loadError}</p>}
      {(search.context.labels.length > 0 || search.context.year) && (
        <p>
          Collection context:{' '}
          {[search.context.labels.join(', '), search.context.year]
            .filter(Boolean)
            .join(' · ')}
          . Used to rank results, not exclude editions.
        </p>
      )}
      {search.context.catalogNumbers.length > 1 && (
        <p>
          Recorded catalog numbers: {search.context.catalogNumbers.join(', ')}.
          Select or edit the number to search.
        </p>
      )}
      {!canSearch && !search.loading && (
        <p>
          Add an artist or catalog number for a focused search, or explicitly
          broaden to title only.
        </p>
      )}
      {search.notice && <p role="alert">{search.notice}</p>}
      {search.candidates && (
        <section aria-label="Discogs editions">
          <p>
            Search results are limited. A missing result does not mean the
            edition is absent. Refine your search or enter its release ID.
          </p>
          {search.candidates.length === 0 && (
            <p>No editions found in these results.</p>
          )}
          {search.candidates.length > 0 && (
            <>
              <p>
                <output>
                  {dates.checkingId ? 'Checking edition dates… ' : ''}
                  {dates.checkedCount} of {search.candidates.length} date checks
                  completed.
                </output>{' '}
                Full dates are listed first among checked editions. A full date
                does not mean this is the same edition.
              </p>
              {dates.verifiedCount > 0 && dates.fullDateCount === 0 && (
                <p>
                  {dates.verifiedCount === search.candidates.length
                    ? 'No reliable full date was found for these editions.'
                    : 'No reliable full dates found in checked editions.'}
                </p>
              )}
              {dates.notice && <p role="alert">{dates.notice}</p>}
              <div className="release-date-search-actions">
                {dates.hasMore && (
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={busy || Boolean(dates.checkingId)}
                    onClick={() => {
                      void dates.checkMore()
                    }}
                  >
                    Check more dates
                  </button>
                )}
                {dates.hasFailed && (
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={busy || Boolean(dates.checkingId)}
                    onClick={() => {
                      void dates.retryFailed()
                    }}
                  >
                    Retry failed date checks
                  </button>
                )}
              </div>
            </>
          )}
          <ul>
            {dates.ordered.map(({ candidate, matches }) => (
              <li key={candidate.source.externalId}>
                <div>
                  <strong>{candidate.title}</strong>
                  <span>
                    {[
                      candidate.artists.join(', '),
                      candidate.catalogNumber,
                      candidate.labels.join(', '),
                      candidate.formats.join(', '),
                      candidate.year,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span>
                    {candidateDateLabel(
                      dates.checks[candidate.source.externalId],
                      dates.checkingId === candidate.source.externalId,
                    )}
                  </span>
                  <span>
                    {matches.length
                      ? `Matches: ${matches.join(', ')}`
                      : 'No matching collection evidence; compare carefully.'}
                  </span>
                </div>
                <button
                  type="button"
                  className="button button-secondary button-compact"
                  disabled={busy}
                  onClick={() => onSelect(candidate.source.externalId)}
                >
                  Preview #{candidate.source.externalId}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}
