import { Save } from 'lucide-react'
import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import type { CatalogDictionaries } from '../catalog/catalogApi'
import {
  loadTrackStackSettings,
  updateTrackStackSettings,
} from '../catalog/catalogApi'
import type { SettingsMode } from './settingsModel'
import { EmptyDetailPanel } from './DictionarySettingsPanels'
import { ViewModeSwitch } from './settingsShared'

const defaultStackRelationTypeCodes = ['remixOf', 'versionOf']

type TrackStackSettingsPanelProps = Readonly<{
  dictionaries: CatalogDictionaries
  onModeChange: (mode: SettingsMode) => void
}>

export function TrackStackSettingsPanel({
  dictionaries,
  onModeChange,
}: TrackStackSettingsPanelProps) {
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
          setSelectedCodes(defaultSelectedStackRelationTypeCodes(relationTypes))
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

  function saveSettings() {
    void handleSave()
  }

  function toggleRelationType(code: string, isSelected: boolean) {
    setSelectedCodes((currentCodes) =>
      isSelected
        ? [...currentCodes, code]
        : currentCodes.filter((currentCode) => currentCode !== code),
    )
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
              <p>
                Relation types used to gather versions under original tracks.
              </p>
            </div>
            <button
              className="button button-primary"
              type="button"
              onClick={saveSettings}
            >
              <Save size={16} /> Save
            </button>
          </div>
          <div className="track-stack-settings-grid">
            {relationTypes.map((relationType) => (
              <TrackStackRelationTypeCheckbox
                key={relationType.id}
                isSelected={selectedCodes.includes(relationType.code)}
                relationType={relationType}
                onToggle={toggleRelationType}
              />
            ))}
          </div>
          {status ? <p className="settings-status">{status}</p> : null}
        </section>
      </div>
      <EmptyDetailPanel />
    </section>
  )
}

type TrackStackRelationType = CatalogDictionaries['trackRelationType'][number]

function defaultSelectedStackRelationTypeCodes(
  relationTypes: TrackStackRelationType[],
) {
  return defaultStackRelationTypeCodes.filter((code) =>
    relationTypes.some((entry) => entry.code === code),
  )
}

type TrackStackRelationTypeCheckboxProps = Readonly<{
  isSelected: boolean
  relationType: TrackStackRelationType
  onToggle: (code: string, isSelected: boolean) => void
}>

function TrackStackRelationTypeCheckbox({
  isSelected,
  relationType,
  onToggle,
}: TrackStackRelationTypeCheckboxProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onToggle(relationType.code, event.target.checked)
  }

  return (
    <label className="settings-check">
      <input checked={isSelected} type="checkbox" onChange={handleChange} />
      <span>{relationType.name}</span>
    </label>
  )
}
