import { DeleteSessionRecordButton } from '../manualEntry/DeleteSessionRecordButton'
import {
  catalogEntityHref,
  hasCatalogLink,
  type CatalogLink,
  type CatalogLinkData,
} from '../catalog/catalogLinks'
import type { RelationRecord } from './relationsData'

type RelationDetailProps = {
  catalogData: CatalogLinkData
  onDelete?: () => void
  onEdit?: () => void
  relation: RelationRecord
}

export function RelationDetail({
  catalogData,
  onDelete,
  onEdit,
  relation,
}: RelationDetailProps) {
  const backlinks = [
    ...catalogData.artists
      .filter((artist) =>
        [relation.source, relation.target, relation.linkedEntity].some(
          (value) => value.toLowerCase() === artist.name.toLowerCase(),
        ),
      )
      .map((artist) => ({
        href: `/artists?artist=${encodeURIComponent(artist.id)}`,
        label: artist.name,
        meta: `Artist · ${artist.type}`,
      })),
    ...catalogData.releases
      .filter((release) =>
        [relation.source, relation.target, relation.linkedEntity].some(
          (value) => value.toLowerCase() === release.title.toLowerCase(),
        ),
      )
      .map((release) => ({
        href: `/releases?release=${encodeURIComponent(release.id)}`,
        label: release.title,
        meta: `Release · ${release.artist}`,
      })),
    ...catalogData.tracks
      .filter((track) =>
        [relation.source, relation.target, relation.linkedEntity].some(
          (value) => value.toLowerCase() === track.title.toLowerCase(),
        ),
      )
      .map((track) => ({
        href: `/tracks?track=${encodeURIComponent(track.id)}`,
        label: track.title,
        meta: `Track · ${track.artist}`,
      })),
    ...catalogData.ownedItems
      .filter((item) =>
        [relation.source, relation.target, relation.linkedEntity].some(
          (value) => value.toLowerCase() === item.title.toLowerCase(),
        ),
      )
      .map((item) => ({
        href: `/owned-items?ownedItem=${encodeURIComponent(item.id)}`,
        label: item.title,
        meta: `${item.medium} · ${item.status}`,
      })),
    ...(catalogData.playlists ?? [])
      .filter((playlist) =>
        relation.searchHints.some((hint) =>
          playlist.name.toLowerCase().includes(hint.toLowerCase()),
        ),
      )
      .map((playlist) => ({
        href: `/playlists?playlist=${encodeURIComponent(playlist.id)}`,
        label: playlist.name,
        meta: `${playlist.type} playlist`,
      })),
  ]

  return (
    <aside className="panel detail-panel" aria-labelledby="relation-title">
      <div className="detail-header">
        <div className="detail-title-row">
          <span className="entity-type">{relation.relationType}</span>
          {onEdit ? (
            <span className="badge badge-tag">Editable collection record</span>
          ) : null}
        </div>
        <h2 id="relation-title">
          {relation.source} to {relation.target}
        </h2>
        <p>{relation.role}</p>
        {onEdit ? (
          <div className="detail-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={onEdit}
            >
              Edit record
            </button>
            {onDelete ? (
              <DeleteSessionRecordButton
                confirmationMessage="Delete this relation? This cannot be undone."
                onDelete={onDelete}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {relation.context ? (
        <p className="detail-summary">{relation.context}</p>
      ) : null}

      <section className="detail-section" aria-labelledby="relation-endpoints">
        <h3 id="relation-endpoints">Endpoints</h3>
        <dl className="detail-list">
          <div>
            <dt>Source</dt>
            <dd>
              <LinkedEntityText
                catalogData={catalogData}
                link={relation.sourceLink}
                text={relation.source}
              />{' '}
              · <span>{relation.sourceType}</span>
            </dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd>
              <LinkedEntityText
                catalogData={catalogData}
                link={relation.targetLink}
                text={relation.target}
              />{' '}
              · <span>{relation.targetType}</span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="relation-context">
        <h3 id="relation-context">Relation context</h3>
        <dl className="detail-list">
          <div>
            <dt>Type</dt>
            <dd>{relation.relationType}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{relation.role}</dd>
          </div>
          <div>
            <dt>Direction</dt>
            <dd>{relation.direction}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="relation-evidence">
        <h3 id="relation-evidence">Linked evidence</h3>
        <dl className="detail-list">
          <div>
            <dt>{relation.linkedEntityType}</dt>
            <dd>
              <LinkedEntityText
                catalogData={catalogData}
                link={relation.linkedEntityLink}
                text={relation.linkedEntity}
              />
            </dd>
          </div>
          {relation.evidence ? (
            <div>
              <dt>Evidence</dt>
              <dd>{relation.evidence}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="relation-hints">
        <h3 id="relation-hints">Search hints</h3>
        <BadgeList values={relation.searchHints} />
      </section>

      <section className="detail-section" aria-labelledby="relation-backlinks">
        <h3 id="relation-backlinks">Related catalog records</h3>
        {backlinks.length > 0 ? (
          <div className="relation-list">
            {backlinks.map((link) => (
              <article key={`${link.href}-${link.label}`}>
                <a className="detail-link" href={link.href}>
                  {link.label}
                </a>
                <p>{link.meta}</p>
              </article>
            ))}
          </div>
        ) : (
          <p>No related catalog records found yet.</p>
        )}
      </section>
    </aside>
  )
}

type LinkedEntityTextProps = {
  catalogData: CatalogLinkData
  link?: CatalogLink
  text: string
}

function LinkedEntityText({ catalogData, link, text }: LinkedEntityTextProps) {
  if (!link || !hasCatalogLink(catalogData, link)) {
    return <span>{text}</span>
  }

  return (
    <a className="detail-link" href={catalogEntityHref(link)}>
      {text}
    </a>
  )
}

type BadgeListProps = {
  values: string[]
}

function BadgeList({ values }: BadgeListProps) {
  return (
    <span className="badge-list">
      {values.map((value, index) => (
        <span key={`${value}-${index}`} className="badge badge-tag">
          {value}
        </span>
      ))}
    </span>
  )
}

export function EmptyDetailPanel() {
  return (
    <aside
      className="panel detail-panel empty-detail-panel"
      aria-labelledby="empty-relation-detail-title"
      aria-live="polite"
    >
      <div className="detail-header">
        <span className="entity-type">No selection</span>
        <h2 id="empty-relation-detail-title">No matching relations.</h2>
      </div>

      <p className="detail-summary">
        Try another source, target, type, role, release or track.
      </p>
    </aside>
  )
}
