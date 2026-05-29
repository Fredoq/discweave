import { useEffect, useMemo, useState } from 'react'
import { ReleaseCoverPanel } from '../releases/ReleaseDetail'
import type {
  CatalogDictionaries,
  CatalogGraphContext,
  CatalogGraphLink,
  CatalogSearchResult,
} from './catalogApi'
import { loadRelease } from './catalogApi'
import { catalogEntityHref } from './catalogLinks'
import {
  formatGraphRelation,
  formatRoleFacet,
  isGraphArtistRole,
} from './catalogDisplayLabels'
import { displayEntityType } from './catalogWorkspaceShared'
import { toReleaseCoverImage } from './api/catalogValueMappers'
import type { ReleaseCoverImage } from '../releases/releasesData'

export function GraphDetailPanel({
  context,
  dictionaries,
  graphStatus,
  onRemoveReleaseCover,
  onUploadReleaseCover,
  result,
}: {
  context: CatalogGraphContext | null
  dictionaries?: CatalogDictionaries
  graphStatus: 'idle' | 'loading' | 'ready' | 'missing' | 'error'
  onRemoveReleaseCover?: (releaseId: string) => Promise<void> | void
  onUploadReleaseCover?: (releaseId: string, file: File) => Promise<void> | void
  result: CatalogSearchResult | null
}) {
  if (!result) {
    return <EmptyDetailPanel />
  }

  if (graphStatus === 'loading') {
    return (
      <aside className="panel detail-panel" aria-live="polite">
        <div className="detail-header">
          <span className="entity-type">{displayEntityType(result.type)}</span>
          <h2>{result.title}</h2>
          <p role="status">Loading relationship context…</p>
        </div>
      </aside>
    )
  }

  if (graphStatus === 'missing') {
    return (
      <aside className="panel detail-panel" aria-live="polite">
        <div className="detail-header">
          <span className="entity-type">No access</span>
          <h2>{result.title}</h2>
          <p className="detail-summary">
            This catalog entity is no longer available in the active collection.
          </p>
        </div>
      </aside>
    )
  }

  if (graphStatus === 'error') {
    return (
      <aside className="panel detail-panel" aria-live="polite">
        <div className="detail-header">
          <span className="entity-type">{displayEntityType(result.type)}</span>
          <h2>{result.title}</h2>
          <p className="detail-summary">
            Relationship context could not be loaded.
          </p>
        </div>
      </aside>
    )
  }

  if (!context) {
    return <EmptyDetailPanel />
  }

  const appearanceLinks =
    context.entity.type === 'artist'
      ? [...context.sections.releases, ...context.sections.tracks]
      : context.sections.releases
  const trackLinks =
    context.entity.type === 'artist' ? [] : context.sections.tracks

  return (
    <aside
      className="panel detail-panel"
      aria-labelledby="detail-title"
      aria-label={context.entity.title}
    >
      <div className="detail-header">
        <span className="entity-type">
          {displayEntityType(context.entity.type)}
        </span>
        <h2 id="detail-title">{context.entity.title}</h2>
        <p>{context.entity.subtitle ?? result.subtitle ?? 'Catalog entity'}</p>
      </div>

      {context.entity.summary ? (
        <p className="detail-summary">{context.entity.summary}</p>
      ) : null}

      {context.entity.type === 'release' ? (
        <ServerReleaseCoverPanel
          releaseId={context.entity.id}
          releaseTitle={context.entity.title}
          onRemoveCover={onRemoveReleaseCover}
          onUploadCover={onUploadReleaseCover}
        />
      ) : null}

      <section className="detail-section" aria-labelledby="catalog-open-title">
        <h3 id="catalog-open-title">Workspace link</h3>
        <a
          className="detail-link"
          href={catalogEntityHref({
            kind: context.entity.type,
            id: context.entity.id,
          })}
        >
          Open in workspace
        </a>
      </section>

      <ArtistCreditsSection
        credits={context.sections.credits}
        dictionaries={dictionaries}
        links={context.sections.artists}
      />
      <GraphSection
        title="Relations"
        links={context.sections.relations}
        dictionaries={dictionaries}
      />
      <GraphSection
        title="Appearances"
        links={appearanceLinks}
        dictionaries={dictionaries}
      />
      <GraphSection
        title="Tracks"
        links={trackLinks}
        dictionaries={dictionaries}
      />
      <GraphSection
        title="Owned copies"
        links={context.sections.ownedCopies}
        dictionaries={dictionaries}
      />
      <GraphSection
        title="Labels"
        links={context.sections.labels}
        dictionaries={dictionaries}
      />
      <GraphSection
        title="Playlists"
        links={context.sections.playlists}
        dictionaries={dictionaries}
      />
      <GraphSection
        title="Media coverage"
        links={context.sections.media}
        dictionaries={dictionaries}
      />
      <section className="detail-section" aria-labelledby="signals-title">
        <h3 id="signals-title">Collector signals</h3>
        <BadgeList
          values={formatCollectorSignals(context.collectorSignals)}
          variant="tag"
        />
      </section>
    </aside>
  )
}

function GraphSection({
  dictionaries,
  links,
  title,
}: {
  dictionaries?: CatalogDictionaries
  links: CatalogGraphLink[]
  title: string
}) {
  const id = `${title.toLowerCase().replaceAll(' ', '-')}-title`
  const groups = groupGraphLinks(links, title, dictionaries)

  return (
    <section className="detail-section" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      {links.length === 0 ? (
        <p className="detail-summary">None recorded.</p>
      ) : (
        <div className="graph-link-groups">
          {groups.map((group) => (
            <div className="graph-link-group" key={group.label}>
              {isRedundantGroupLabel(
                title,
                group.label,
                groups.length,
              ) ? null : (
                <h4>{group.label}</h4>
              )}
              <ul className="graph-link-list">
                {group.links.map((link) => (
                  <li key={`${link.type}:${link.id}:${link.relation ?? title}`}>
                    <a
                      className="detail-link"
                      href={catalogEntityHref({
                        kind: link.type,
                        id: link.id,
                      })}
                    >
                      {link.title}
                    </a>
                    {link.subtitle ? (
                      <span>{formatGraphLinkSubtitle(link, dictionaries)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ArtistCreditsSection({
  credits,
  dictionaries,
  links,
}: {
  credits: CatalogGraphLink[]
  dictionaries?: CatalogDictionaries
  links: CatalogGraphLink[]
}) {
  const id = 'artists-title'
  const artists = mergeArtistLinks([...links, ...credits], dictionaries)

  return (
    <section className="detail-section" aria-labelledby={id}>
      <h3 id={id}>Artists</h3>
      {artists.length === 0 ? (
        <p className="detail-summary">None recorded.</p>
      ) : (
        <ul className="graph-link-list graph-artist-role-list">
          {artists.map((artist) => (
            <li key={artist.key}>
              <a className="detail-link" href={artist.href}>
                {artist.title}
              </a>
              <BadgeList values={artist.roles} variant="tag" />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ServerReleaseCoverPanel({
  releaseId,
  releaseTitle,
  onRemoveCover,
  onUploadCover,
}: {
  releaseId: string
  releaseTitle: string
  onRemoveCover?: (releaseId: string) => Promise<void> | void
  onUploadCover?: (releaseId: string, file: File) => Promise<void> | void
}) {
  const [coverImage, setCoverImage] = useState<ReleaseCoverImage | undefined>()
  const [coverLoadStatus, setCoverLoadStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isCurrent = true
    queueMicrotask(() => {
      if (isCurrent) {
        setCoverImage(undefined)
        setCoverLoadStatus('loading')
      }
    })

    void loadRelease(releaseId)
      .then((release) => {
        if (!isCurrent) {
          return
        }

        setCoverImage(
          release?.coverImage
            ? toReleaseCoverImage(release.coverImage)
            : undefined,
        )
        setCoverLoadStatus('ready')
      })
      .catch(() => {
        if (isCurrent) {
          setCoverLoadStatus('error')
        }
      })

    return () => {
      isCurrent = false
    }
  }, [releaseId, reloadKey])

  const release = useMemo(
    () => ({ id: releaseId, title: releaseTitle, coverImage }),
    [coverImage, releaseId, releaseTitle],
  )

  return (
    <section
      className="detail-section"
      aria-busy={coverLoadStatus === 'loading'}
      aria-labelledby="release-cover-title"
    >
      <h3 id="release-cover-title">Cover</h3>
      <ReleaseCoverPanel
        release={release}
        onRemoveCover={
          onRemoveCover
            ? async (id) => {
                await onRemoveCover(id)
                setReloadKey((key) => key + 1)
              }
            : undefined
        }
        onUploadCover={
          onUploadCover
            ? async (id, file) => {
                await onUploadCover(id, file)
                setReloadKey((key) => key + 1)
              }
            : undefined
        }
      />
    </section>
  )
}

function mergeArtistLinks(
  links: CatalogGraphLink[],
  dictionaries: CatalogDictionaries | undefined,
) {
  const artists = new Map<
    string,
    {
      href: string
      key: string
      roles: string[]
      roleSet: Set<string>
      title: string
    }
  >()

  for (const link of links) {
    if (link.type !== 'artist') {
      continue
    }

    const key = link.id || link.title.toLowerCase()
    const existing = artists.get(key) ?? {
      href: catalogEntityHref({ kind: 'artist', id: link.id }),
      key,
      roles: [],
      roleSet: new Set<string>(),
      title: link.title,
    }

    for (const candidate of [link.relation, link.subtitle]) {
      if (!isGraphArtistRole(candidate, dictionaries)) {
        continue
      }

      const role = formatRoleFacet(candidate ?? '', dictionaries)
      if (role !== 'Artist' && existing.roleSet.has('Artist')) {
        existing.roleSet.delete('Artist')
        existing.roles = existing.roles.filter(
          (existingRole) => existingRole !== 'Artist',
        )
      }

      if (!existing.roleSet.has(role)) {
        existing.roleSet.add(role)
        existing.roles.push(role)
      }
    }

    if (existing.roles.length === 0) {
      existing.roles.push('Artist')
      existing.roleSet.add('Artist')
    }

    artists.set(key, existing)
  }

  return [...artists.values()]
}

function groupGraphLinks(
  links: CatalogGraphLink[],
  title: string,
  dictionaries: CatalogDictionaries | undefined,
) {
  const groups = new Map<string, CatalogGraphLink[]>()

  for (const link of links) {
    const label = link.relation?.trim() || defaultGraphGroupLabel(link, title)
    const displayLabel = formatGraphRelation(label, dictionaries)
    groups.set(displayLabel, [...(groups.get(displayLabel) ?? []), link])
  }

  return [...groups.entries()].map(([label, groupLinks]) => ({
    label,
    links: groupLinks,
  }))
}

function formatGraphLinkSubtitle(
  link: CatalogGraphLink,
  dictionaries: CatalogDictionaries | undefined,
) {
  return isGraphArtistRole(link.subtitle, dictionaries)
    ? formatRoleFacet(link.subtitle ?? '', dictionaries)
    : link.subtitle
}

function isRedundantGroupLabel(
  sectionTitle: string,
  label: string,
  groupCount: number,
) {
  if (groupCount !== 1) {
    return false
  }

  const normalizedTitle = normalizeLabel(sectionTitle)
  const normalizedLabel = normalizeLabel(label)

  return (
    normalizedTitle === normalizedLabel ||
    (normalizedTitle === 'tracks' && normalizedLabel === 'tracklist') ||
    (normalizedTitle === 'labels' && normalizedLabel === 'label') ||
    (normalizedTitle === 'ownedcopies' && normalizedLabel === 'ownedcopy')
  )
}

function normalizeLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function defaultGraphGroupLabel(link: CatalogGraphLink, title: string) {
  switch (link.type) {
    case 'artist':
      return 'Artist links'
    case 'release':
      return 'Release links'
    case 'track':
      return 'Track links'
    case 'ownedItem':
      return 'Owned copy links'
    case 'label':
      return 'Label links'
    case 'playlist':
      return 'Playlist links'
    case 'relation':
      return 'Relation links'
    default:
      return title
  }
}

function EmptyDetailPanel() {
  return (
    <aside
      className="panel detail-panel empty-detail-panel"
      aria-labelledby="empty-detail-title"
      aria-live="polite"
    >
      <div className="detail-header">
        <span className="entity-type">Catalog</span>
        <h2 id="empty-detail-title">Select a catalog row.</h2>
      </div>
      <p className="detail-summary">
        Relationship context appears after selecting a result.
      </p>
    </aside>
  )
}

const collectorSignalLabels: Record<string, string> = {
  digitalWithoutPhysical: 'Digital without physical',
  losslessAvailable: 'Lossless available',
  lossyWithoutLossless: 'Lossy without lossless',
  missingCredits: 'Missing credits',
  physicalWithoutDigital: 'Physical without digital',
  wantedNotOwned: 'Wanted not owned',
}

function formatCollectorSignals(values: string[]) {
  return values.map(formatCollectorSignal)
}

function formatCollectorSignal(value: string) {
  return (
    collectorSignalLabels[value] ??
    value.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  )
}

function BadgeList({
  values,
  variant,
}: {
  values: string[]
  variant: 'media' | 'tag'
}) {
  if (values.length === 0) {
    return <span className="badge badge-tag">None</span>
  }

  return (
    <span className="badge-list">
      {values.map((value) => (
        <span key={value} className={`badge badge-${variant}`}>
          {value}
        </span>
      ))}
    </span>
  )
}
