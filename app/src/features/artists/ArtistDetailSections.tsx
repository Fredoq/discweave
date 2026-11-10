import { ReleaseCoverThumbnail } from '../releases/ReleaseCoverThumbnail'
import type { ArtistAppearance } from './ArtistDetail'

type AppearanceGroupProps = Readonly<{
  emptyText: string
  items: ArtistAppearance[]
  title: string
}>

export function AppearanceGroup({
  emptyText,
  items,
  title,
}: AppearanceGroupProps) {
  const titleId = `artist-${slugForDomId(title)}-appearances-title`

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

function slugForDomId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

type AppearanceListProps = Readonly<{
  emptyText: string
  items: ArtistAppearance[]
}>

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
}: Readonly<{
  emptyText?: string
  values: string[]
}>) {
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
