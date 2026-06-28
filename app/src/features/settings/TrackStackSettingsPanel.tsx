import { Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { CatalogDictionaries } from '../catalog/catalogApi'
import {
  loadTrackStackSettings,
  updateTrackStackSettings,
} from '../catalog/catalogApi'
import type { SettingsMode } from './settingsModel'
import { EmptyDetailPanel } from './DictionarySettingsPanels'
import { ViewModeSwitch } from './settingsShared'

const defaultStackRelationTypeCodes = ['remixOf', 'versionOf']

export function TrackStackSettingsPanel({
  dictionaries,
  onModeChange,
}: {
  dictionaries: CatalogDictionaries
  onModeChange: (mode: SettingsMode) => void
}) {
  const [selectedCodes, setSelectedCodes] = useState<string[]>(
    defaultStackRelationTypeCodes,
  )
  const [status, setStatus] = useState('')
  const relationTypes = useMemo(
    () => dictionaries.trackRelationType.filter((entry) => entry.isActive),
    [dictionaries.trackRelationType],
  )

  useEffect(() => {
    let isActive = true
    loadTrackStackSettings()
      .then((settings) => {
        if (isActive && settings) {
          setSelectedCodes(settings.defaultRelationTypeCodes)
        }
      })
      .catch(() => {
        if (isActive) {
          setSelectedCodes(
            defaultStackRelationTypeCodes.filter((code) =>
              relationTypes.some((entry) => entry.code === code),
            ),
          )
        }
      })

    return () => {
      isActive = false
    }
  }, [relationTypes])

  async function handleSave() {
    setStatus('Saving')
    try {
      const settings = await updateTrackStackSettings({
        defaultRelationTypeCodes: selectedCodes,
      })
      setSelectedCodes(settings.defaultRelationTypeCodes)
      setStatus('Saved')
    } catch {
      setStatus('Could not save')
    }
  }

  return (
    <section className="catalog-layout" aria-label="Track stack settings">
      <div className="catalog-main">
        <div className="settings-mode-row">
          <ViewModeSwitch mode="trackStacks" onModeChange={onModeChange} />
        </div>
        <section className="panel settings-panel">
          <div className="panel-heading">
            <div>
              <h2>Track stacks</h2>
              <p>Relation types used to gather versions under original tracks.</p>
            </div>
            <button
              className="button button-primary"
              type="button"
              onClick={() => {
                void handleSave()
              }}
            >
              <Save size={16} /> Save
            </button>
          </div>
          <div className="track-stack-settings-grid">
            {relationTypes.map((relationType) => (
              <label className="settings-check" key={relationType.id}>
                <input
                  checked={selectedCodes.includes(relationType.code)}
                  type="checkbox"
                  onChange={(event) =>
                    setSelectedCodes((currentCodes) =>
                      event.target.checked
                        ? [...currentCodes, relationType.code]
                        : currentCodes.filter(
                            (code) => code !== relationType.code,
                          ),
                    )
                  }
                />
                <span>{relationType.name}</span>
              </label>
            ))}
          </div>
          {status ? <p className="settings-status">{status}</p> : null}
        </section>
      </div>
      <EmptyDetailPanel />
    </section>
  )
}
