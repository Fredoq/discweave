import { ExternalLink, X } from 'lucide-react'
import { useState } from 'react'
import {
  openLocalFile,
  type LocalFileOpenResult,
  type LocalOpenableFile,
} from './localFileOpenModel'
import './local-files.css'

type LocalFileOpenPanelProps = Readonly<{
  files: LocalOpenableFile[]
  initialResults?: Record<string, LocalFileOpenResult>
  title: string
  onClose: () => void
}>

export function LocalFileOpenPanel({
  files,
  initialResults = {},
  title,
  onClose,
}: LocalFileOpenPanelProps) {
  const [results, setResults] = useState<Record<string, LocalFileOpenResult>>(
    {},
  )
  const [pendingFileKeys, setPendingFileKeys] = useState<Set<string>>(
    () => new Set(),
  )

  async function handleOpen(file: LocalOpenableFile) {
    const key = localFileOpenResultKey(file)
    setPendingFileKeys((current) => new Set(current).add(key))
    try {
      const result = await openLocalFile(file)
      setResults((current) => ({ ...current, [key]: result }))
    } finally {
      setPendingFileKeys((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }

  return (
    <section className="panel local-file-open-panel" aria-label={title}>
      <div className="panel-heading local-file-open-heading">
        <div>
          <h2>{title}</h2>
          <p>
            {files.length} {files.length === 1 ? 'file' : 'files'} available
          </p>
        </div>
        <button
          aria-label="Close local file list"
          className="icon-button"
          type="button"
          onClick={onClose}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="local-file-open-list">
        {files.map((file) => {
          const resultKey = localFileOpenResultKey(file)
          const result = results[resultKey] ?? initialResults[file.id]
          const isPending = pendingFileKeys.has(resultKey)

          return (
            <article className="local-file-open-row" key={file.id}>
              <div className="local-file-open-copy">
                <div className="local-file-open-title-row">
                  <strong>{file.trackTitle}</strong>
                  <span className="badge badge-tag">{file.format}</span>
                </div>
                <p>
                  {file.releaseTitle} · {file.position}
                </p>
                <p className="local-file-open-path" title={file.path}>
                  {file.path}
                </p>
                {result ? <LocalFileOpenResultMessage result={result} /> : null}
              </div>
              <button
                aria-label={`Open local file ${file.trackTitle} ${file.releaseTitle} ${file.position}`}
                className="button button-secondary button-compact local-file-open-button"
                disabled={isPending}
                type="button"
                onClick={() => {
                  void handleOpen(file)
                }}
              >
                <ExternalLink size={14} aria-hidden="true" />
                {isPending ? 'Opening...' : 'Open'}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function localFileOpenResultKey(file: LocalOpenableFile) {
  return `${file.id}:${file.path}`
}

function LocalFileOpenResultMessage({
  result,
}: {
  readonly result: LocalFileOpenResult
}) {
  if (result.ok) {
    return <output className="local-file-open-status is-success">Opened</output>
  }

  return (
    <p className="local-file-open-status is-error" role="alert">
      {result.message}
    </p>
  )
}
