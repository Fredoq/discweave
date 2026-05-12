import type { AppRoute, AppRoutePath } from '../../app/routes'

type SectionPlaceholderProps = {
  route: AppRoute
}

type SectionNote = {
  primary: string
  secondary: string
  metrics: string[]
}

const sectionNotes = {
  '/catalog': {
    primary: 'Catalog search remains the working default archive surface.',
    secondary:
      'Use the catalog route for search, saved views and archive details.',
    metrics: ['4 catalog rows', '5 saved views', '1 detail panel'],
  },
  '/artists': {
    primary: 'Artist records will index people, bands, aliases and projects.',
    secondary:
      'This section will anchor member, alias, producer, remixer and collaboration queries.',
    metrics: ['Alias graph', 'Credit roles', 'Member links'],
  },
  '/releases': {
    primary: 'Release records will stay separate from owned physical copies.',
    secondary:
      'This workspace is reserved for albums, EPs, singles, compilations and promos.',
    metrics: ['Release type', 'Label', 'Year'],
  },
  '/tracks': {
    primary:
      'Track records will support versions, durations and credit lookup.',
    secondary:
      'This route will connect standalone tracks to releases and local files.',
    metrics: ['Versions', 'Duration', 'File links'],
  },
  '/playlists': {
    primary: 'Playlists will group tracks by manual choice or catalog rules.',
    secondary:
      'This route will keep playlists focused on archive criteria, not playback.',
    metrics: ['Manual lists', 'Smart rules', 'Owned availability'],
  },
  '/owned-items': {
    primary: 'Owned items answer whether this collection has a concrete copy.',
    secondary:
      'This route will track medium, condition, storage and ownership status.',
    metrics: ['Condition', 'Storage', 'Digitization state'],
  },
  '/relations': {
    primary: 'Relations will expose the graph behind archive navigation.',
    secondary:
      'This route will cover aliases, group memberships, remixes, versions and collaborations.',
    metrics: ['Alias', 'Member of', 'Remix of'],
  },
  '/imports': {
    primary: 'Imports will bring local audio folders into the archive safely.',
    secondary:
      'This workspace will surface file metadata reads and idempotent folder scans.',
    metrics: ['ID3', 'FLAC', 'Vorbis'],
  },
  '/exports': {
    primary: 'Exports will keep the collection portable and understandable.',
    secondary:
      'This route will prepare JSON and CSV snapshots without vendor lock-in.',
    metrics: ['JSON', 'CSV', 'Backup ready'],
  },
  '/settings': {
    primary: 'Settings will hold local archive defaults and preferences.',
    secondary:
      'This route is reserved for collection-level configuration, not public profile controls.',
    metrics: ['Private data', 'Local account', 'Defaults'],
  },
} satisfies Record<AppRoutePath, SectionNote>

export function SectionPlaceholder({ route }: SectionPlaceholderProps) {
  const note = getSectionNote(route.path)

  return (
    <section
      className="section-workspace"
      aria-label={`${route.label} workspace`}
    >
      <section
        className="panel section-panel"
        aria-labelledby="section-state-title"
      >
        <div className="panel-heading">
          <div>
            <h2 id="section-state-title">Workspace baseline</h2>
            <p>{note.primary}</p>
          </div>
        </div>

        <div className="section-panel-body">
          <p>{note.secondary}</p>
          <div
            className="metric-strip"
            aria-label={`${route.label} focus areas`}
          >
            {note.metrics.map((metric) => (
              <span key={metric} className="badge badge-tag">
                {metric}
              </span>
            ))}
          </div>
        </div>
      </section>

      <aside
        className="panel section-side-panel"
        aria-labelledby="next-step-title"
      >
        <div>
          <p className="section-label">Next model work</p>
          <h2 id="next-step-title">Keep collection data private</h2>
        </div>

        <p>
          Future data for this workspace should stay scoped to the active local
          collection without exposing internal ids in the UI.
        </p>
      </aside>
    </section>
  )
}

function getSectionNote(path: AppRoutePath) {
  return sectionNotes[path]
}
