import { useMemo, useState } from 'react'
import './App.css'

type CatalogEntry = {
  id: string
  title: string
  artist: string
  type: 'Artist' | 'Release' | 'Track' | 'Owned item'
  detail: string
  status: string
}

const catalogEntries: CatalogEntry[] = [
  {
    id: 'entry-1',
    title: 'Selected Ambient Works 85-92',
    artist: 'Aphex Twin',
    type: 'Release',
    detail: 'Warp, 1992, CD and digital',
    status: 'Owned',
  },
  {
    id: 'entry-2',
    title: 'Polynomial-C',
    artist: 'Aphex Twin',
    type: 'Track',
    detail: 'Appears on digital and CD copies',
    status: 'Lossless file',
  },
  {
    id: 'entry-3',
    title: 'Blue Monday',
    artist: 'New Order',
    type: 'Owned item',
    detail: '12-inch vinyl, shelf A3',
    status: 'Needs digitization',
  },
  {
    id: 'entry-4',
    title: 'The DFA Remix',
    artist: 'The DFA',
    type: 'Artist',
    detail: 'Remixer credit index',
    status: 'Relation focus',
  },
]

function App() {
  const [query, setQuery] = useState('')

  const visibleEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (normalizedQuery.length === 0) {
      return catalogEntries
    }

    return catalogEntries.filter((entry) =>
      [entry.title, entry.artist, entry.type, entry.detail, entry.status]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    )
  }, [query])

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <a className="brand" href="/">
          Cratebase
        </a>
        <nav className="navigation">
          <a aria-current="page" href="/catalog">
            Catalog
          </a>
          <a href="/relations">Relations</a>
          <a href="/imports">Imports</a>
          <a href="/exports">Exports</a>
        </nav>
      </aside>

      <section className="workspace" aria-labelledby="workspace-heading">
        <header className="workspace-header">
          <div>
            <h1 id="workspace-heading">Collection catalog</h1>
            <p>Search releases, tracks, media, ownership and credits.</p>
          </div>
          <button className="primary-action" type="button">
            Add entry
          </button>
        </header>

        <label className="search-field">
          <span>Search catalog</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Artist, release, track, label, role or medium"
          />
        </label>

        <div className="content-grid">
          <section className="catalog-panel" aria-labelledby="results-heading">
            <div className="panel-heading">
              <h2 id="results-heading">Catalog results</h2>
              <span>{visibleEntries.length} shown</span>
            </div>
            <ul className="result-list">
              {visibleEntries.map((entry) => (
                <li key={entry.id}>
                  <div>
                    <span className="entry-type">{entry.type}</span>
                    <h3>{entry.title}</h3>
                    <p>{entry.artist}</p>
                  </div>
                  <div className="entry-meta">
                    <span>{entry.detail}</span>
                    <strong>{entry.status}</strong>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <aside className="relation-panel" aria-labelledby="relations-heading">
            <h2 id="relations-heading">Relation focus</h2>
            <dl>
              <div>
                <dt>Credit graph</dt>
                <dd>Artists, aliases, remixers, producers and members</dd>
              </div>
              <div>
                <dt>Ownership</dt>
                <dd>Owned, wanted, sold and needs digitization</dd>
              </div>
              <div>
                <dt>Media</dt>
                <dd>Digital, vinyl, CD, cassette and other formats</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>
    </main>
  )
}

export default App
