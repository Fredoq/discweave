import { ReleaseCoverThumbnail } from '../releases/ReleaseCoverThumbnail'
import type { ArtistIdentity } from './artistIdentity'
import type { ArtistRelationshipGroup } from './artistRelationshipGroups'
import type { ArtistAppearance } from './ArtistDetail'

type AppearanceGroupProps = {
  emptyText: string
  items: ArtistAppearance[]
  title: string
}

export function AppearanceGroup({
  emptyText,
  items,
  title,
}: AppearanceGroupProps) {
  const titleId = `artist-${title.toLowerCase()}-appearances-title`

  return (
    <section className="artist-appearance-group" aria-labelledby={titleId}>
      <div className="artist-appearance-heading">
        <h4 id={titleId}>{title}</h4>
        <span>{items.length}</span>
      </div>
      <AppearanceList emptyText={emptyText} items={items} />
    </section>
  )
}

export function ArtistRelationshipGroups({
  groups,
}: {
  groups: ArtistRelationshipGroup[]
}) {
  if (groups.length === 0) {
    return <p className="detail-empty">No direct artist relations recorded.</p>
  }

  return (
    <div className="artist-relationship-groups">
      {groups.map((group) => (
        <div className="artist-relationship-group" key={group.title}>
          <div className="artist-relationship-group-heading">
            <strong>{group.title}</strong>
            <span>{group.items.length}</span>
          </div>
          <div className="artist-relationship-list">
            {group.items.map((item) => {
              const roles =
                group.title === 'Member of' || group.title === 'Members'
                  ? []
                  : item.roles

              return (
                <article className="artist-relationship-card" key={item.key}>
                  <div className="artist-relationship-card-header">
                    <strong>{item.label}</strong>
                    {roles.length > 0 ? <BadgeList values={roles} /> : null}
                  </div>
                  {item.detail ? <p>{item.detail}</p> : null}
                </article>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ArtistIdentitySection({
  identity,
}: {
  identity: ArtistIdentity
}) {
  return (
    <section className="detail-section" aria-labelledby="artist-identity-title">
      <h3 id="artist-identity-title">Identity</h3>
      <dl className="detail-list">
        <div>
          <dt>Real name</dt>
          <dd>{identity.realName}</dd>
        </div>
        {identity.aliases.length > 0 ? (
          <div>
            <dt>Aliases</dt>
            <dd>{identity.aliases.join(', ')}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}

type AppearanceListProps = {
  emptyText: string
  items: ArtistAppearance[]
}

function AppearanceList({ emptyText, items }: AppearanceListProps) {
  if (items.length === 0) {
    return <p className="detail-empty">{emptyText}</p>
  }

  return (
    <div className="artist-appearance-list">
      {items.map((item) => (
        <article
          className={
            item.thumbnailTitle
              ? 'artist-appearance-card artist-appearance-card-with-thumbnail'
              : 'artist-appearance-card'
          }
          key={item.key}
        >
          {item.thumbnailTitle ? (
            <ReleaseCoverThumbnail
              coverImage={item.coverImage}
              title={item.thumbnailTitle}
            />
          ) : null}
          <div className="artist-appearance-card-body">
            <div className="artist-appearance-card-header">
              {item.href ? (
                <a className="detail-link" href={item.href}>
                  {item.label}
                </a>
              ) : (
                <strong>{item.label}</strong>
              )}
              <BadgeList values={item.roles} />
            </div>
            <p>{item.meta}</p>
            {item.context ? <p>{item.context}</p> : null}
          </div>
        </article>
      ))}
    </div>
  )
}

export function BadgeList({
  emptyText = 'None recorded',
  values,
}: {
  emptyText?: string
  values: string[]
}) {
  if (values.length === 0) {
    return <span className="detail-empty">{emptyText}</span>
  }

  return (
    <span className="badge-list">
      {values.map((value) => (
        <span key={value} className="badge badge-tag">
          {value}
        </span>
      ))}
    </span>
  )
}
