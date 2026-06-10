import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  createImportPattern,
  deleteImportPattern,
  loadImportPatterns,
  testImportPattern,
  updateImportPattern,
  type ImportPattern,
  type ImportPatternKind,
} from '../catalog/catalogApi'
import { parseSortOrder, type SettingsMode } from './settingsModel'
import { ViewModeSwitch } from './settingsShared'

export function ImportPatternSettings({
  onModeChange,
}: {
  onModeChange: (mode: SettingsMode) => void
}) {
  const [patterns, setPatterns] = useState<ImportPattern[]>([])
  const [kind, setKind] = useState<ImportPatternKind>('releaseFolder')
  const [template, setTemplate] = useState(
    '[{catalogNumber}, {releaseDate}] {artist} - {title}',
  )
  const [sortOrder, setSortOrder] = useState('100')
  const [testInput, setTestInput] = useState(
    '[AA 01, 2016-07-15] Steven Julien - Fallen',
  )
  const [preview, setPreview] = useState('')
  const [status, setStatus] = useState('Ready')

  useEffect(() => {
    let isMounted = true

    void loadImportPatterns()
      .then((response) => {
        if (isMounted) {
          setPatterns(response.items)
        }
      })
      .catch((error: unknown) => {
        console.error(error)
        if (isMounted) {
          setStatus('Failed to load patterns')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  async function loadPatterns() {
    const response = await loadImportPatterns()
    setPatterns(response.items)
  }

  async function createPattern() {
    try {
      await createImportPattern({
        kind,
        template,
        sortOrder: parseSortOrder(sortOrder, 100),
        isActive: true,
      })
      await loadPatterns()
      setStatus('Pattern saved')
    } catch (error) {
      console.error(error)
      setStatus('Failed to save pattern')
    }
  }

  async function testPattern() {
    try {
      const result = await testImportPattern(kind, template, testInput)
      setPreview(JSON.stringify(result.fields, null, 2))
      setStatus(result.matched ? 'Pattern matched' : 'No match')
    } catch (error) {
      console.error(error)
      setPreview('')
      setStatus('Test failed')
    }
  }

  async function togglePattern(pattern: ImportPattern) {
    try {
      await updateImportPattern(pattern.id, {
        kind: pattern.kind,
        template: pattern.template,
        sortOrder: pattern.sortOrder,
        isActive: !pattern.isActive,
      })
      await loadPatterns()
      setStatus('Pattern updated')
    } catch (error) {
      console.error(error)
      setStatus('Failed to update pattern')
    }
  }

  async function removePattern(patternId: string) {
    try {
      await deleteImportPattern(patternId)
      await loadPatterns()
      setStatus('Pattern deleted')
    } catch (error) {
      console.error(error)
      setStatus('Failed to delete pattern')
    }
  }

  return (
    <section className="catalog-layout" aria-label="Import pattern settings">
      <div className="catalog-main">
        <div className="settings-mode-row">
          <ViewModeSwitch mode="importPatterns" onModeChange={onModeChange} />
        </div>
        <section className="panel settings-controls">
          <div className="settings-control-grid import-pattern-grid">
            <label className="settings-control">
              <span>Kind</span>
              <select
                value={kind}
                onChange={(event) => {
                  const nextKind = event.target.value as ImportPatternKind
                  setKind(nextKind)
                  setTemplate(
                    nextKind === 'releaseFolder'
                      ? '[{catalogNumber}, {releaseDate}] {artist} - {title}'
                      : '{position} {artist} - {title}',
                  )
                }}
              >
                <option value="releaseFolder">Release folder</option>
                <option value="trackFile">Track file</option>
              </select>
            </label>
            <label className="settings-control">
              <span>Template</span>
              <input
                value={template}
                onChange={(event) => setTemplate(event.target.value)}
              />
            </label>
            <label className="settings-control">
              <span>Sort</span>
              <input
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              />
            </label>
            <button
              className="button button-primary"
              type="button"
              onClick={() => {
                void createPattern()
              }}
            >
              <Plus size={16} /> Add
            </button>
          </div>
          <div className="settings-control-grid import-pattern-test-grid">
            <label className="settings-control">
              <span>Test input</span>
              <input
                value={testInput}
                onChange={(event) => setTestInput(event.target.value)}
              />
            </label>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                void testPattern()
              }}
            >
              Test
            </button>
          </div>
        </section>
        <section className="panel catalog-panel">
          <div className="panel-heading">
            <div>
              <h2>Import patterns</h2>
              <p>{status}</p>
            </div>
          </div>
          <div className="catalog-table-wrap">
            <table className="catalog-table">
              <thead>
                <tr>
                  <th scope="col">Kind</th>
                  <th scope="col">Template</th>
                  <th scope="col">Sort</th>
                  <th scope="col">State</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {patterns.map((pattern) => (
                  <tr key={pattern.id}>
                    <td data-label="Kind">{pattern.kind}</td>
                    <td data-label="Template">{pattern.template}</td>
                    <td data-label="Sort">{pattern.sortOrder}</td>
                    <td data-label="State">
                      {pattern.isActive ? 'Active' : 'Paused'}
                    </td>
                    <td data-label="Actions">
                      <button
                        className="button button-secondary button-compact"
                        disabled={pattern.isBuiltin}
                        type="button"
                        onClick={() => {
                          void togglePattern(pattern)
                        }}
                      >
                        {pattern.isActive ? 'Pause' : 'Activate'}
                      </button>
                      <button
                        className="button button-danger button-compact"
                        disabled={pattern.isBuiltin}
                        type="button"
                        onClick={() => {
                          void removePattern(pattern.id)
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <section className="panel detail-panel">
        <div className="detail-header">
          <h2>Preview</h2>
          <p>{preview || 'No preview yet'}</p>
        </div>
      </section>
    </section>
  )
}
