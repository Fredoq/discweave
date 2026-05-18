import { Database, Download, FileArchive, FileJson } from 'lucide-react'
import { useState } from 'react'
import type { ArtistRecord } from '../artists/artistsData'
import type {
  CatalogDictionaries,
  RatingCriterion,
} from '../catalog/catalogApi'
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackRecord } from '../tracks/tracksData'

type ExportsWorkspaceProps = {
  artists: ArtistRecord[]
  dictionaries: CatalogDictionaries
  ownedItems: OwnedItemRecord[]
  playlists: PlaylistRecord[]
  ratingCriteria: RatingCriterion[]
  relations: RelationRecord[]
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
}

type ExportFormat = 'csv' | 'json'

const exportFormatLabels: Record<ExportFormat, string> = {
  csv: 'CSV',
  json: 'JSON',
}

export function ExportsWorkspace({
  artists,
  dictionaries,
  ownedItems,
  playlists,
  ratingCriteria,
  relations,
  releases,
  tracks,
}: ExportsWorkspaceProps) {
  const dictionaryCount = Object.values(dictionaries).reduce(
    (total, entries) => total + entries.length,
    0,
  )
  const metrics = [
    `${artists.length} artists`,
    `${releases.length} releases`,
    `${tracks.length} tracks`,
    `${ownedItems.length} owned items`,
    `${relations.length} relations`,
    `${playlists.length} playlists`,
  ]
  const isDesktop = isCratebaseDesktop()
  const [pendingExport, setPendingExport] = useState<ExportFormat | null>(null)
  const [downloadStatus, setDownloadStatus] = useState('Ready')
  const [downloadError, setDownloadError] = useState<string | null>(null)

  async function downloadDesktopExport(format: ExportFormat) {
    if (!window.cratebaseDesktop?.exports) {
      setDownloadError('Desktop export is unavailable.')
      return
    }

    const label = exportFormatLabels[format]
    setPendingExport(format)
    setDownloadStatus(`Saving ${label} export`)
    setDownloadError(null)

    try {
      const result = await window.cratebaseDesktop.exports.download(format)
      if (result.cancelled) {
        setDownloadStatus(`${label} export cancelled`)
        return
      }

      setDownloadStatus(`${label} export saved`)
    } catch (error) {
      setDownloadError(errorMessage(error))
      setDownloadStatus(`${label} export failed`)
    } finally {
      setPendingExport(null)
    }
  }

  return (
    <section className="exports-layout" aria-label="Exports workspace">
      <section className="panel exports-panel" aria-labelledby="exports-title">
        <div className="panel-heading">
          <div>
            <h2 id="exports-title">Collection snapshot</h2>
            <p>Portable catalog data for the active collection.</p>
          </div>
          <Database size={18} aria-hidden="true" />
        </div>

        <div className="exports-panel-body">
          <div className="metric-strip" aria-label="Exported record counts">
            {metrics.map((metric) => (
              <span key={metric} className="badge badge-tag">
                {metric}
              </span>
            ))}
          </div>

          <div className="exports-downloads" aria-label="Download formats">
            <ExportDownload
              description="Single structured snapshot for backup and programmatic use."
              format="json"
              href="/api/exports/json"
              icon="json"
              isDesktop={isDesktop}
              isPending={pendingExport === 'json'}
              label="Download JSON"
              onDesktopDownload={downloadDesktopExport}
            />
            <ExportDownload
              description="Zip archive with separate CSV tables for spreadsheets."
              format="csv"
              href="/api/exports/csv"
              icon="csv"
              isDesktop={isDesktop}
              isPending={pendingExport === 'csv'}
              label="Download CSV"
              onDesktopDownload={downloadDesktopExport}
            />
          </div>

          {isDesktop ? (
            <p
              className={downloadError ? 'exports-error' : 'exports-status'}
              role={downloadError ? 'alert' : 'status'}
            >
              {downloadError ?? downloadStatus}
            </p>
          ) : null}
        </div>
      </section>

      <aside
        className="panel exports-side-panel"
        aria-labelledby="exports-scope-title"
      >
        <div>
          <p className="section-label">Snapshot scope</p>
          <h2 id="exports-scope-title">Catalog, graph and settings</h2>
        </div>
        <dl className="exports-summary-list">
          <div>
            <dt>Dictionary entries</dt>
            <dd>{dictionaryCount}</dd>
          </div>
          <div>
            <dt>Rating criteria</dt>
            <dd>{ratingCriteria.length}</dd>
          </div>
          <div>
            <dt>Formats</dt>
            <dd>JSON, CSV</dd>
          </div>
        </dl>
      </aside>
    </section>
  )
}

type ExportDownloadProps = {
  description: string
  format: ExportFormat
  href: string
  icon: 'csv' | 'json'
  isDesktop: boolean
  isPending: boolean
  label: string
  onDesktopDownload: (format: ExportFormat) => Promise<void>
}

function ExportDownload({
  description,
  format,
  href,
  icon,
  isDesktop,
  isPending,
  label,
  onDesktopDownload,
}: ExportDownloadProps) {
  const Icon = icon === 'json' ? FileJson : FileArchive

  return (
    <div className="exports-download-row">
      <span className="exports-download-icon" aria-hidden="true">
        <Icon size={18} strokeWidth={2.1} />
      </span>
      <span>
        <strong>{label.replace('Download ', '')}</strong>
        <small>{description}</small>
      </span>
      {isDesktop ? (
        <button
          className="button button-primary"
          disabled={isPending}
          type="button"
          onClick={() => {
            void onDesktopDownload(format)
          }}
        >
          <Download size={15} aria-hidden="true" />
          {label}
        </button>
      ) : (
        <a className="button button-primary" href={href} download>
          <Download size={15} aria-hidden="true" />
          {label}
        </a>
      )}
    </div>
  )
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Export failed.'
}

function isCratebaseDesktop() {
  return window.cratebaseDesktop?.isDesktop === true
}
