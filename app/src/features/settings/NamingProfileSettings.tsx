import { Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  createNamingProfile,
  deleteNamingProfile,
  loadNamingProfiles,
  updateNamingProfile,
  type NamingProfile,
  type NamingProfileRequest,
} from '../catalog/catalogApi'
import {
  namingProfileSearchText,
  parseSortOrder,
  type SettingsMode,
} from './settingsModel'
import { SearchField, ViewModeSwitch } from './settingsShared'

const defaultReleaseFolderTemplate =
  '{releaseArtists} - {title} ({year}) [{source} {format} {bitDepth}]'
const defaultTrackFileTemplate = '{position2} {title}'
const defaultTrackFileWithArtistTemplate =
  '{position2} {trackArtists} - {title}'

export function NamingProfileSettings({
  onModeChange,
}: {
  onModeChange: (mode: SettingsMode) => void
}) {
  const [profiles, setProfiles] = useState<NamingProfile[]>([])
  const [query, setQuery] = useState('')
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [status, setStatus] = useState('Loading naming profiles')
  const queryTerms = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  )
  const filteredProfiles = useMemo(
    () =>
      profiles
        .filter((profile) => {
          const searchText = namingProfileSearchText(profile)

          return queryTerms.every((term) => searchText.includes(term))
        })
        .sort(
          (left, right) =>
            left.sortOrder - right.sortOrder ||
            left.name.localeCompare(right.name),
        ),
    [profiles, queryTerms],
  )
  const selectedProfile =
    filteredProfiles.find((profile) => profile.id === selectedProfileId) ??
    filteredProfiles[0] ??
    null

  useEffect(() => {
    let isMounted = true

    void refreshProfiles()
      .then((loadedProfiles) => {
        if (!isMounted) {
          return
        }

        setProfiles(loadedProfiles)
        setStatus(`${loadedProfiles.length} profiles loaded`)
      })
      .catch((error: unknown) => {
        console.error(error)
        if (isMounted) {
          setStatus('Failed to load naming profiles')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  async function reloadProfiles(nextSelectedId?: string) {
    const loadedProfiles = await refreshProfiles()
    setProfiles(loadedProfiles)
    if (nextSelectedId !== undefined) {
      setSelectedProfileId(nextSelectedId)
    }
    setStatus(`${loadedProfiles.length} profiles loaded`)
  }

  async function createProfile(request: NamingProfileRequest) {
    try {
      const profile = await createNamingProfile(request)
      await reloadProfiles(profile.id)
      setStatus('Naming profile saved')
    } catch (error) {
      console.error(error)
      setStatus('Failed to save naming profile')
    }
  }

  async function saveProfile(profileId: string, request: NamingProfileRequest) {
    try {
      await updateNamingProfile(profileId, request)
      await reloadProfiles(profileId)
      setStatus('Naming profile updated')
    } catch (error) {
      console.error(error)
      setStatus('Failed to update naming profile')
    }
  }

  async function removeProfile(profile: NamingProfile) {
    try {
      await deleteNamingProfile(profile.id)
      await reloadProfiles('')
      setStatus('Naming profile deleted')
    } catch (error) {
      console.error(error)
      setStatus('Failed to delete naming profile')
    }
  }

  return (
    <section className="catalog-layout" aria-label="Naming profile settings">
      <div className="catalog-main">
        <SearchField
          placeholder="Profile name, template, status or default"
          query={query}
          onQueryChange={setQuery}
        />
        <div className="settings-mode-row">
          <ViewModeSwitch mode="namingProfiles" onModeChange={onModeChange} />
        </div>
        <NamingProfileContextPanel
          count={filteredProfiles.length}
          status={status}
        />
        <NamingProfileCreatePanel onCreateProfile={createProfile} />
        <section
          className="panel catalog-panel"
          aria-labelledby="naming-profiles-title"
        >
          <div className="panel-heading">
            <div>
              <h2 id="naming-profiles-title">Naming profiles</h2>
              <p>{status}</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="catalog-table workspace-table">
              <thead>
                <tr>
                  <th scope="col">Profile</th>
                  <th scope="col">Folder template</th>
                  <th scope="col">Track template</th>
                  <th scope="col">State</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map((profile) => (
                  <tr
                    aria-selected={profile.id === selectedProfile?.id}
                    className={
                      profile.id === selectedProfile?.id
                        ? 'is-selected'
                        : undefined
                    }
                    key={profile.id}
                  >
                    <th scope="row">
                      <button
                        className="row-title"
                        type="button"
                        onClick={() => setSelectedProfileId(profile.id)}
                      >
                        <strong>{profile.name}</strong>
                        <span>{profile.isDefault ? 'Default' : 'Profile'}</span>
                      </button>
                    </th>
                    <td data-label="Folder template">
                      {profile.releaseFolderTemplate}
                    </td>
                    <td data-label="Track template">
                      {profile.trackFileTemplate}
                    </td>
                    <td data-label="State">{profileState(profile)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {selectedProfile ? (
        <NamingProfileDetail
          key={selectedProfile.id}
          onDeleteProfile={removeProfile}
          onSaveProfile={saveProfile}
          profile={selectedProfile}
        />
      ) : (
        <EmptyNamingProfilePanel />
      )}
    </section>
  )
}

async function refreshProfiles() {
  const response = await loadNamingProfiles()

  return response.items
}

function NamingProfileContextPanel({
  count,
  status,
}: {
  count: number
  status: string
}) {
  return (
    <section
      className="panel settings-context-panel"
      aria-label="Naming profile scope"
    >
      <div className="settings-context-copy">
        <span className="entity-type">Naming profiles</span>
        <strong>{count} profiles shown</strong>
        <p>{status}</p>
      </div>
    </section>
  )
}

function NamingProfileCreatePanel({
  onCreateProfile,
}: {
  onCreateProfile: (request: NamingProfileRequest) => Promise<void> | void
}) {
  const [name, setName] = useState('')
  const [sortOrder, setSortOrder] = useState('100')
  const canSubmit = name.trim().length > 0

  function handleCreate() {
    if (!canSubmit) {
      return
    }

    void onCreateProfile({
      name: name.trim(),
      releaseFolderTemplate: defaultReleaseFolderTemplate,
      trackFileTemplate: defaultTrackFileTemplate,
      trackFileWithArtistTemplate: defaultTrackFileWithArtistTemplate,
      sortOrder: parseSortOrder(sortOrder, 100),
      isDefault: false,
      isActive: true,
    })
    setName('')
    setSortOrder('100')
  }

  return (
    <section
      className="panel settings-controls settings-controls-naming-create"
      aria-label="Add naming profile"
    >
      <div className="settings-control-grid naming-profile-create-grid">
        <label className="settings-control">
          <span>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="settings-control">
          <span>Order</span>
          <input
            inputMode="numeric"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </label>
        <button
          className="button button-primary"
          disabled={!canSubmit}
          type="button"
          onClick={handleCreate}
        >
          <Plus size={16} aria-hidden="true" />
          Add
        </button>
      </div>
    </section>
  )
}

function NamingProfileDetail({
  onDeleteProfile,
  onSaveProfile,
  profile,
}: {
  onDeleteProfile: (profile: NamingProfile) => Promise<void> | void
  onSaveProfile: (
    profileId: string,
    request: NamingProfileRequest,
  ) => Promise<void> | void
  profile: NamingProfile
}) {
  const [name, setName] = useState(profile.name)
  const [releaseFolderTemplate, setReleaseFolderTemplate] = useState(
    profile.releaseFolderTemplate,
  )
  const [trackFileTemplate, setTrackFileTemplate] = useState(
    profile.trackFileTemplate,
  )
  const [trackFileWithArtistTemplate, setTrackFileWithArtistTemplate] =
    useState(profile.trackFileWithArtistTemplate)
  const [sortOrder, setSortOrder] = useState(String(profile.sortOrder))
  const [isDefault, setIsDefault] = useState(profile.isDefault)
  const [isActive, setIsActive] = useState(profile.isActive)
  const canEdit = !profile.isBuiltin
  const canSave =
    canEdit &&
    name.trim().length > 0 &&
    releaseFolderTemplate.trim().length > 0 &&
    trackFileTemplate.trim().length > 0 &&
    trackFileWithArtistTemplate.trim().length > 0

  function handleSave() {
    if (!canSave) {
      return
    }

    void onSaveProfile(profile.id, {
      name: name.trim(),
      releaseFolderTemplate: releaseFolderTemplate.trim(),
      trackFileTemplate: trackFileTemplate.trim(),
      trackFileWithArtistTemplate: trackFileWithArtistTemplate.trim(),
      sortOrder: parseSortOrder(sortOrder, profile.sortOrder),
      isDefault,
      isActive,
    })
  }

  return (
    <aside
      className="panel detail-panel"
      aria-labelledby="naming-profile-title"
    >
      <div className="detail-header">
        <p className="entity-type">
          {profile.isBuiltin ? 'Built-in' : 'Custom'}
        </p>
        <h2 id="naming-profile-title">{profile.name}</h2>
        <p>{profileState(profile)}</p>
      </div>
      <section className="detail-section" aria-label="Naming profile editor">
        <label className="settings-control">
          <span>Name</span>
          <input
            disabled={!canEdit}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="settings-control">
          <span>Release folder template</span>
          <textarea
            disabled={!canEdit}
            rows={3}
            value={releaseFolderTemplate}
            onChange={(event) => setReleaseFolderTemplate(event.target.value)}
          />
        </label>
        <label className="settings-control">
          <span>Track file template</span>
          <textarea
            disabled={!canEdit}
            rows={2}
            value={trackFileTemplate}
            onChange={(event) => setTrackFileTemplate(event.target.value)}
          />
        </label>
        <label className="settings-control">
          <span>Track file with artist template</span>
          <textarea
            disabled={!canEdit}
            rows={2}
            value={trackFileWithArtistTemplate}
            onChange={(event) =>
              setTrackFileWithArtistTemplate(event.target.value)
            }
          />
        </label>
        <label className="settings-control">
          <span>Order</span>
          <input
            disabled={!canEdit}
            inputMode="numeric"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </label>
        <label className="settings-check">
          <input
            checked={isDefault}
            disabled={!canEdit}
            type="checkbox"
            onChange={(event) => setIsDefault(event.target.checked)}
          />
          Default
        </label>
        <label className="settings-check">
          <input
            checked={isActive}
            disabled={!canEdit}
            type="checkbox"
            onChange={(event) => setIsActive(event.target.checked)}
          />
          Active
        </label>
        <button
          className="button button-primary"
          disabled={!canSave}
          type="button"
          onClick={handleSave}
        >
          <Save size={16} aria-hidden="true" />
          Save
        </button>
      </section>
      <section className="detail-section" aria-label="Naming profile removal">
        <button
          className="button button-secondary"
          disabled={!canEdit}
          type="button"
          onClick={() => {
            void onDeleteProfile(profile)
          }}
        >
          <Trash2 size={16} aria-hidden="true" />
          Delete
        </button>
      </section>
    </aside>
  )
}

function EmptyNamingProfilePanel() {
  return (
    <aside className="panel detail-panel" aria-label="Naming profile detail">
      <div className="detail-header">
        <h2>No profile selected</h2>
        <p>Create or select a naming profile.</p>
      </div>
    </aside>
  )
}

function profileState(profile: NamingProfile) {
  return [
    profile.isDefault ? 'Default' : null,
    profile.isActive ? 'Active' : 'Inactive',
    profile.isBuiltin ? 'Built-in' : 'Custom',
  ]
    .filter(Boolean)
    .join(' / ')
}
