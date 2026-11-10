import { ChevronRight } from 'lucide-react'
import type {
  ArtistRelationshipGroup,
  ArtistRelationshipNote,
  ArtistRelationshipReference,
} from './artistRelationshipGroups'
export function ArtistRelationships({
  groups,
  references,
  onSelectArtist,
}: Readonly<{
  groups: ArtistRelationshipGroup[]
  references: ArtistRelationshipReference[]
  onSelectArtist?: (id: string) => void
}>) {
  return (
    <>
      {groups.length === 0 ? (
        <p className="detail-empty">No linked artist relationships recorded.</p>
      ) : null}
      {groups.map((group) => (
        <section
          className="artist-inspector-group"
          key={group.key}
          aria-label={group.title}
        >
          <h3>
            {group.title} <span>{group.items.length}</span>
          </h3>
          <ul
            className={
              group.title === 'Identities & Aliases'
                ? 'artist-inspector-relations is-identities'
                : 'artist-inspector-relations'
            }
          >
            {group.items.map((item) => (
              <li key={item.key}>
                {onSelectArtist ? (
                  <button
                    type="button"
                    className="artist-inspector-relation-link"
                    aria-label={`Open artist ${item.label}`}
                    onClick={() => onSelectArtist(item.artistId)}
                  >
                    <strong>{item.label}</strong>
                    <span className="artist-inspector-relation-type">
                      {item.type}
                    </span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                ) : (
                  <a
                    className="artist-inspector-relation-link"
                    href={`/artists?artist=${encodeURIComponent(item.artistId)}`}
                  >
                    <strong>{item.label}</strong>
                    <ChevronRight size={14} aria-hidden="true" />
                  </a>
                )}
                <RelationshipNotes notes={item.notes} label={item.label} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {references.length > 0 ? (
        <details className="artist-additional-references">
          <summary>
            Additional references <span>({references.length})</span>
          </summary>
          <p>
            These names are recorded in relationship notes, without a verified
            link to a single artist.
          </p>
          <ul>
            {references.map((reference) => (
              <li key={reference.key}>
                <div className="artist-reference-heading">
                  <strong>{reference.label}</strong>
                  <span>{reference.status}</span>
                </div>
                {reference.status === 'Ambiguous name' ? (
                  <p>
                    More than one artist has this name. No record is selected.
                  </p>
                ) : null}
                <RelationshipNotes
                  notes={reference.notes}
                  label={reference.label}
                />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  )
}
function RelationshipNotes({
  notes,
  label,
}: Readonly<{ notes: ArtistRelationshipNote[]; label: string }>) {
  if (!notes.length) return null
  const [first, ...additional] = notes
  return (
    <div className="artist-inspector-relation-notes">
      <p>{noteText(first)}</p>
      {additional.length > 0 ? (
        <details>
          <summary aria-label={`More relationship details for ${label}`}>
            More details ({additional.length})
          </summary>
          {additional.map((note) => (
            <p key={note.key}>{noteText(note)}</p>
          ))}
        </details>
      ) : null}
    </div>
  )
}
function noteText(note: ArtistRelationshipNote) {
  const role =
    note.direction === 'incoming' && !['Aliases', 'Member'].includes(note.role)
      ? `${note.role} (incoming)`
      : note.role
  return [role, note.detail].filter(Boolean).join(' · ')
}
