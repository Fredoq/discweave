import { Database, Download, FileArchive, FileJson } from 'lucide-react'
import { useState } from 'react'
import './exports.css'
import type { ArtistRecord } from '../artists/artistsData'
import {
  type CatalogDictionaries,
  type RatingCriterion,
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
  onSessionExpired: () => void
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
  onSessionExpired,
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
  const hasCatalogData =
    artists.length +
      releases.length +
      tracks.length +
      ownedItems.length +
      relations.length +
      playlists.length >
    0

  async function downloadBrowserExport(format: ExportFormat) {
    const label = exportFormatLabels[format]
    const exportUrl = `/api/exports/${format}`
    setPendingExport(format)
    setDownloadStatus(`Downloading ${label} export`)
    setDownloadError(null)

    try {
      const response = await fetch(exportUrl, {
        credentials: 'include',
        method: 'HEAD',
      })

      if (response.status === 401) {
        onSessionExpired()
        return
      }

      if (response.status === 405 || response.status === 501) {
        triggerBrowserDownload(exportUrl, exportFileName(null, format))
        setDownloadStatus(`${label} export started`)
        return
      }

      if (!response.ok) {
        throw await exportErrorFromResponse(response)
      }

      triggerBrowserDownload(
        exportUrl,
        exportFileName(response.headers.get('Content-Disposition'), format),
      )
      setDownloadStatus(`${label} export started`)
    } catch (error) {
      setDownloadError(errorMessage(error))
      setDownloadStatus(`${label} export failed`)
    } finally {
      setPendingExport(null)
    }
  }

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
              icon="json"
              isDesktop={isDesktop}
              isDisabled={Boolean(pendingExport)}
              isPending={pendingExport === 'json'}
              label="Download JSON"
              onBrowserDownload={downloadBrowserExport}
              onDesktopDownload={downloadDesktopExport}
            />
            <ExportDownload
              description="Zip archive with separate CSV tables for spreadsheets."
              format="csv"
              icon="csv"
              isDesktop={isDesktop}
              isDisabled={Boolean(pendingExport)}
              isPending={pendingExport === 'csv'}
              label="Download CSV"
              onBrowserDownload={downloadBrowserExport}
              onDesktopDownload={downloadDesktopExport}
            />
          </div>

          {!hasCatalogData ? (
            <p className="exports-status">
              The export will contain archive settings and empty catalog tables.
            </p>
          ) : null}
          <p
            className={downloadError ? 'exports-error' : 'exports-status'}
            role={downloadError ? 'alert' : 'status'}
          >
            {downloadError ?? downloadStatus}
          </p>
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
  icon: 'csv' | 'json'
  isDisabled: boolean
  isDesktop: boolean
  isPending: boolean
  label: string
  onBrowserDownload: (format: ExportFormat) => Promise<void>
  onDesktopDownload: (format: ExportFormat) => Promise<void>
}

function ExportDownload({
  description,
  format,
  icon,
  isDisabled,
  isDesktop,
  isPending,
  label,
  onBrowserDownload,
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
      <button
        className="button button-primary"
        disabled={isDisabled}
        type="button"
        onClick={() => {
          void (isDesktop
            ? onDesktopDownload(format)
            : onBrowserDownload(format))
        }}
      >
        <Download size={15} aria-hidden="true" />
        {isPending ? label.replace('Download', 'Downloading') : label}
      </button>
    </div>
  )
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Export failed.'
}

async function exportErrorFromResponse(response: Response) {
  const body = await readOptionalJson<{ message?: string | null }>(response)
  return new Error(
    body?.message ?? `Export failed with HTTP ${response.status}.`,
  )
}

async function readOptionalJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

function triggerBrowserDownload(url: string, fileName: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
}

function exportFileName(
  contentDisposition: string | null,
  format: ExportFormat,
) {
  if (contentDisposition) {
    const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/)
    if (encodedMatch?.[1]) {
      return decodeURIComponent(encodedMatch[1])
    }

    const quotedMatch = contentDisposition.match(/filename="?([^";]+)"?/)
    if (quotedMatch?.[1]) {
      return quotedMatch[1]
    }
  }

  return format === 'csv' ? 'cratebase-export.zip' : 'cratebase-export.json'
}

function isCratebaseDesktop() {
  return window.cratebaseDesktop?.isDesktop === true
}
