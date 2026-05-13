import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DeleteSessionRecordButton } from '../manualEntry/DeleteSessionRecordButton'
import { ManualEntryPanel } from '../manualEntry/ManualEntryPanel'
import {
  createManualRecordId,
  textOrFallback,
} from '../manualEntry/manualEntryUtils'
import {
  playlistTouchesTrack,
  relationTouchesLink,
  uniqueValues,
} from '../catalog/catalogGraph'
import {
  durationPartsToText,
  durationTextToParts,
  normalizeDurationPart,
  type DurationParts,
} from '../catalog/durationFormat'
import { toCreditRole } from '../catalog/creditRoles'
import {
  activeDictionaryLabels,
  defaultCatalogDictionaries,
  type CatalogDictionaries,
} from '../catalog/catalogApi'
import { FilterSelect } from '../catalog/FilterSelect'
import { useCatalogSelection } from '../catalog/useCatalogSelection'
import type { ArtistRecord } from '../artists/artistsData'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { RelationRecord } from '../relations/relationsData'
import type {
  LocalFileMetadata,
  TrackCredit,
  TrackRecord,
  TrackRelation,
  TrackReleaseAppearance,
} from './tracksData'

const emptyVersionNote = 'No version relation recorded'

type TracksWorkspaceProps = {
  artists?: ArtistRecord[]
  isManualEntryOpen?: boolean
  locationSearch?: string
  onAddTrack?: (track: TrackRecord) => void
  onDeleteTrack?: (trackId: string) => void
  onUpdateTrack?: (track: TrackRecord) => void
  onManualEntryClose?: () => void
  playlists?: PlaylistRecord[]
  releases?: ReleaseRecord[]
  relations?: RelationRecord[]
  tracks?: TrackRecord[]
  dictionaries?: CatalogDictionaries
}

export function TracksWorkspace({
  artists = [],
  isManualEntryOpen = false,
  locationSearch = window.location.search,
  onAddTrack,
  onDeleteTrack,
  onUpdateTrack,
  onManualEntryClose = () => {},
  playlists = [],
  releases = [],
  relations = [],
  tracks: providedTracks,
  dictionaries = defaultCatalogDictionaries,
}: TracksWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({
    format: '',
    creditRole: '',
    relationType: '',
    releaseLink: '',
  })
  const [manualTracks, setManualTracks] = useState<TrackRecord[]>([])
  const [editingTrackId, setEditingTrackId] = useState('')
  const tracks = useMemo(() => {
    return [...(providedTracks ?? []), ...manualTracks]
  }, [manualTracks, providedTracks])

  const visibleTracks = useMemo(() => {
    const terms = queryTerms(query)

    return tracks.filter(
      (track) =>
        terms.every((term) => trackSearchText(track).includes(term)) &&
        (!filters.format || track.fileMetadata.format === filters.format) &&
        (!filters.creditRole ||
          track.credits.some((credit) => credit.role === filters.creditRole)) &&
        (!filters.relationType ||
          track.versionHint === filters.relationType ||
          track.relations.some(
            (relation) => relation.type === filters.relationType,
          )) &&
        (!filters.releaseLink ||
          (filters.releaseLink === 'Linked'
            ? trackReleaseAppearances(track).some(
                (appearance) => appearance.releaseId,
              )
            : !trackReleaseAppearances(track).some(
                (appearance) => appearance.releaseId,
              ))),
    )
  }, [filters, query, tracks])
  const { selectedRecord: selectedTrack, selectRecord: selectTrack } =
    useCatalogSelection({
      locationSearch,
      queryParam: 'track',
      records: tracks,
      routePath: '/tracks',
      visibleRecords: visibleTracks,
    })

  function handleAddTrack(track: TrackRecord) {
    if (onAddTrack) {
      onAddTrack(track)
    } else {
      setManualTracks((currentTracks) => [...currentTracks, track])
    }

    setQuery('')
    selectTrack(track.id)
    onManualEntryClose()
  }

  function handleUpdateTrack(track: TrackRecord) {
    if (onUpdateTrack) {
      onUpdateTrack(track)
    } else {
      setManualTracks((currentTracks) =>
        currentTracks.map((currentTrack) =>
          currentTrack.id === track.id ? track : currentTrack,
        ),
      )
    }

    setQuery('')
    selectTrack(track.id)
    setEditingTrackId('')
  }

  function handleDeleteTrack(trackId: string) {
    if (onDeleteTrack) {
      onDeleteTrack(trackId)
    } else {
      setManualTracks((currentTracks) =>
        currentTracks.filter((track) => track.id !== trackId),
      )
    }

    setQuery('')
    setEditingTrackId('')
  }

  const editingTrack = tracks.find((track) => track.id === editingTrackId)

  return (
    <section className="catalog-layout" aria-label="Tracks workspace">
      <div className="catalog-main">
        <SearchField
          label="Search tracks"
          placeholder="Title, artist, release, duration, role, version or format"
          query={query}
          onQueryChange={setQuery}
        />
        <div className="filter-bar">
          <FilterSelect
            label="File format"
            value={filters.format}
            values={uniqueValues(
              tracks
                .filter(hasRealLocalFile)
                .map((track) => track.fileMetadata.format),
            )}
            onChange={(format) =>
              setFilters((current) => ({ ...current, format }))
            }
          />
          <FilterSelect
            label="Credit role"
            value={filters.creditRole}
            values={uniqueValues(
              tracks.flatMap((track) =>
                track.credits.map((credit) => credit.role),
              ),
            )}
            onChange={(creditRole) =>
              setFilters((current) => ({ ...current, creditRole }))
            }
          />
          <FilterSelect
            label="Version or relation type"
            value={filters.relationType}
            values={uniqueValues(
              tracks.flatMap((track) => [
                trackVersionDisplay(track),
                ...track.relations.map((relation) => relation.type),
              ]),
            )}
            onChange={(relationType) =>
              setFilters((current) => ({ ...current, relationType }))
            }
          />
          <FilterSelect
            label="Release link"
            value={filters.releaseLink}
            values={['Linked', 'Unlinked']}
            onChange={(releaseLink) =>
              setFilters((current) => ({ ...current, releaseLink }))
            }
          />
          <span className="result-count">{visibleTracks.length} shown</span>
        </div>
        {isManualEntryOpen ? (
          <TrackEntryForm
            artists={artists}
            dictionaries={dictionaries}
            onCancel={onManualEntryClose}
            releases={releases}
            tracks={tracks}
            onSubmit={handleAddTrack}
          />
        ) : null}
        {editingTrack ? (
          <TrackEntryForm
            artists={artists}
            dictionaries={dictionaries}
            initialTrack={editingTrack}
            key={editingTrack.id}
            onCancel={() => setEditingTrackId('')}
            releases={releases}
            tracks={tracks}
            onSubmit={handleUpdateTrack}
          />
        ) : null}
        <TrackTable
          selectedTrackId={selectedTrack?.id ?? ''}
          tracks={visibleTracks}
          onSelectTrack={selectTrack}
        />
      </div>

      {selectedTrack ? (
        <TrackDetail
          onEdit={() => setEditingTrackId(selectedTrack.id)}
          onDelete={() => handleDeleteTrack(selectedTrack.id)}
          playlists={playlists}
          relations={relations}
          releases={releases}
          track={selectedTrack}
        />
      ) : (
        <EmptyDetailPanel />
      )}
    </section>
  )
}

type TrackEntryFormProps = {
  artists: ArtistRecord[]
  dictionaries: CatalogDictionaries
  initialTrack?: TrackRecord
  onCancel: () => void
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
  onSubmit: (track: TrackRecord) => void
}

function TrackEntryForm({
  artists,
  dictionaries,
  initialTrack,
  onCancel,
  tracks,
  onSubmit,
}: TrackEntryFormProps) {
  const trackGenreOptions = activeDictionaryLabels(dictionaries, 'genre')
  const trackCreditRoleOptions = activeDictionaryLabels(
    dictionaries,
    'creditRole',
  )
  const [title, setTitle] = useState(initialTrack?.title ?? '')
  const [artist, setArtist] = useState('')
  const [durationParts, setDurationParts] = useState<DurationParts>(() =>
    durationTextToParts(initialTrack?.duration ?? ''),
  )
  const [credits, setCredits] = useState(() =>
    (initialTrack?.credits ?? []).map((credit, index) => ({
      ...credit,
      id: createManualRecordId(
        'track-credit',
        `${initialTrack?.id ?? 'new'}-${index}`,
      ),
    })),
  )
  const appearances = useMemo(
    () => (initialTrack ? trackReleaseAppearances(initialTrack) : []),
    [initialTrack],
  )
  const [selectedGenres, setSelectedGenres] = useState(
    initialTrack?.tags.filter((tag) => trackGenreOptions.includes(tag)) ?? [],
  )
  const [tagsText, setTagsText] = useState(
    initialTrack?.tags
      .filter((tag) => !trackGenreOptions.includes(tag))
      .join(', ') ?? '',
  )
  const hasInvalidCredit = credits.some((credit) => credit.role.length === 0)
  const isValid = title.trim().length > 0 && !hasInvalidCredit
  const candidateArtist = (
    credits.find((credit) => credit.role === 'Main artist')?.artist ??
    credits[0]?.artist ??
    ''
  ).toLowerCase()
  const candidateRelease = (appearances[0]?.releaseTitle ?? '').toLowerCase()
  const duplicateTrack = tracks.find(
    (track) =>
      track.id !== initialTrack?.id &&
      track.title.toLowerCase() === title.trim().toLowerCase() &&
      (candidateArtist.length === 0 ||
        trackArtistDisplay(track).toLowerCase().includes(candidateArtist)) &&
      (candidateRelease.length === 0 ||
        trackReleaseDisplay(track).toLowerCase().includes(candidateRelease)),
  )
  const formTitle = initialTrack ? 'Edit track' : 'Add track'

  function handleDurationPartChange(
    field: keyof DurationParts,
    value: string,
    max: number,
  ) {
    const normalizedValue = normalizeDurationPart(value, max)

    if (normalizedValue === null) {
      return
    }

    setDurationParts((currentParts) => ({
      ...currentParts,
      [field]: normalizedValue,
    }))
  }

  function addCredit() {
    const artistName = artist.trim()
    if (!artistName) {
      return
    }

    const existingArtist = artists.find(
      (record) => record.name.toLowerCase() === artistName.toLowerCase(),
    )
    setCredits((currentCredits) => [
      ...currentCredits,
      {
        id: createManualRecordId('track-credit', artistName),
        artistId: existingArtist?.id,
        artist: existingArtist?.name ?? artistName,
        role: 'Main artist',
        scope: 'Track-level credit.',
      },
    ])
    setArtist('')
  }

  function handleSubmit() {
    const trackTitle = title.trim()
    const trackDuration = textOrFallback(
      durationPartsToText(durationParts),
      initialTrack?.duration ?? 'Unknown duration',
    )
    const normalizedAppearances = appearances.map((appearance) => ({
      releaseId: appearance.releaseId,
      releaseTitle: appearance.releaseTitle,
      releaseArtist: appearance.releaseArtist,
      year: appearance.year,
      label: appearance.label,
      position: appearance.position,
      duration: textOrFallback(appearance.duration, trackDuration),
      versionNote: appearance.versionNote,
    }))
    const primaryAppearance = normalizedAppearances[0]
    const primaryCredit =
      credits.find((credit) => credit.role === 'Main artist') ?? credits[0]
    const existingFileMetadata = initialTrack?.fileMetadata
    const note = primaryAppearance?.versionNote.trim() || ''
    const tags = uniqueValues([
      ...selectedGenres,
      ...tagsText
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ])

    onSubmit({
      ...(initialTrack ?? {}),
      id: initialTrack?.id ?? createManualRecordId('track', trackTitle),
      title: trackTitle,
      artistId: primaryCredit?.artistId,
      artist:
        primaryCredit?.artist ??
        primaryAppearance?.releaseArtist ??
        'Unknown artist',
      release: {
        id: primaryAppearance?.releaseId,
        title: primaryAppearance?.releaseTitle ?? 'Unlinked release',
        artist: primaryAppearance?.releaseArtist ?? 'Unknown artist',
        year: primaryAppearance?.year ?? 'Unknown year',
        label: primaryAppearance?.label ?? 'Unknown label',
      },
      trackNumber: primaryAppearance?.position ?? 'Unnumbered',
      duration: trackDuration,
      versionHint: textOrFallback(
        note,
        initialTrack?.versionHint ?? emptyVersionNote,
      ),
      relationHint: textOrFallback(
        note,
        initialTrack?.relationHint ??
          'Manual track draft with incomplete metadata.',
      ),
      tags: tags.length > 0 ? tags : ['manual entry'],
      credits: credits.map(({ artistId, artist, role, scope }) => ({
        artistId,
        artist,
        role: toCreditRole(role),
        scope,
      })),
      releaseAppearances: normalizedAppearances,
      relations:
        note.length > 0
          ? [
              {
                type: 'Version note',
                target: trackTitle,
                detail: note,
              },
            ]
          : (initialTrack?.relations ?? []),
      fileMetadata: {
        format: existingFileMetadata?.format ?? 'None recorded',
        path: existingFileMetadata?.path ?? 'No file linked',
        bitrate: existingFileMetadata?.bitrate ?? 'Not recorded',
        sampleRate: existingFileMetadata?.sampleRate ?? 'Not recorded',
        channels: existingFileMetadata?.channels ?? 'Not recorded',
        importedAt: existingFileMetadata?.importedAt ?? 'Manual entry',
        checksum: existingFileMetadata?.checksum ?? 'Not recorded',
      },
    })
  }

  return (
    <ManualEntryPanel
      title={formTitle}
      requiredMessage={
        title.trim().length === 0
          ? 'Title is required.'
          : 'Set a role for each track artist.'
      }
      isValid={isValid}
      onCancel={onCancel}
      onSubmit={handleSubmit}
      submitLabel={initialTrack ? 'Save record' : 'Add record'}
    >
      <div className="manual-entry-wide track-entry-layout">
        <div className="track-entry-main">
          <section className="release-form-section release-core-section">
            <div className="release-form-section-header">
              <div>
                <h3>Core</h3>
                <p>Track identity and canonical duration.</p>
              </div>
            </div>
            <div className="track-core-grid">
              <label className="track-core-title-field">
                <span>Title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </label>
              <div className="track-duration-field">
                <span>Duration</span>
                <div
                  className="track-duration-control"
                  role="group"
                  aria-label="Track duration"
                >
                  <label>
                    <span>Hours</span>
                    <input
                      aria-label="Track duration hours"
                      inputMode="numeric"
                      min="0"
                      type="number"
                      value={durationParts.hours}
                      onChange={(event) =>
                        handleDurationPartChange(
                          'hours',
                          event.target.value,
                          99,
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Minutes</span>
                    <input
                      aria-label="Track duration minutes"
                      inputMode="numeric"
                      min="0"
                      max="59"
                      type="number"
                      value={durationParts.minutes}
                      onChange={(event) =>
                        handleDurationPartChange(
                          'minutes',
                          event.target.value,
                          59,
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Seconds</span>
                    <input
                      aria-label="Track duration seconds"
                      inputMode="numeric"
                      min="0"
                      max="59"
                      type="number"
                      value={durationParts.seconds}
                      onChange={(event) =>
                        handleDurationPartChange(
                          'seconds',
                          event.target.value,
                          59,
                        )
                      }
                    />
                  </label>
                </div>
              </div>
            </div>
          </section>
          {duplicateTrack ? (
            <p className="manual-entry-warning" role="status">
              Likely duplicate track: {duplicateTrack.title} by{' '}
              {trackArtistDisplay(duplicateTrack)} on{' '}
              {trackReleaseDisplay(duplicateTrack)}. Submit is still allowed for
              this session.
            </p>
          ) : null}
          <section className="release-form-section">
            <div className="release-form-section-header">
              <div>
                <h3>Track credits</h3>
                <p>Artist contributions for this track.</p>
              </div>
            </div>
            <div className="release-artist-editor">
              <div className="track-credit-composer">
                <label className="release-artist-composer-name">
                  <span>Artist</span>
                  <input
                    list="track-artist-options"
                    placeholder="Search or type artist"
                    value={artist}
                    onChange={(event) => setArtist(event.target.value)}
                  />
                </label>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={addCredit}
                >
                  Add artist
                </button>
              </div>
              <div
                className="release-artist-chip-list"
                aria-label="Track credits"
              >
                {credits.map((credit) => (
                  <div className="release-artist-chip" key={credit.id}>
                    <span className="release-artist-chip-name">
                      {credit.artist}
                    </span>
                    <label className="release-artist-chip-role">
                      <span className="release-artist-chip-role-face">
                        <span>{credit.role}</span>
                        <span className="release-artist-chip-role-caret" />
                      </span>
                      <select
                        aria-label={`Role for ${credit.artist}`}
                        className="release-artist-chip-role-select"
                        value={credit.role}
                        onChange={(event) =>
                          setCredits((currentCredits) =>
                            currentCredits.map((currentCredit) =>
                              currentCredit.id === credit.id
                                ? {
                                    ...currentCredit,
                                    role: toCreditRole(event.target.value),
                                  }
                                : currentCredit,
                            ),
                          )
                        }
                      >
                        {trackCreditRoleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      aria-label={`Remove ${credit.artist}`}
                      className="release-artist-chip-remove"
                      type="button"
                      onClick={() =>
                        setCredits((currentCredits) =>
                          currentCredits.filter(
                            (currentCredit) => currentCredit.id !== credit.id,
                          ),
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="release-form-section">
            <div className="release-form-section-header">
              <div>
                <h3>Classification</h3>
                <p>Genres and free-form tags.</p>
              </div>
            </div>
            <div className="genre-chip-list">
              {trackGenreOptions.map((genre) => (
                <label className="genre-chip" key={genre}>
                  <input
                    checked={selectedGenres.includes(genre)}
                    type="checkbox"
                    onChange={(event) =>
                      setSelectedGenres((currentGenres) =>
                        event.target.checked
                          ? [...currentGenres, genre]
                          : currentGenres.filter(
                              (currentGenre) => currentGenre !== genre,
                            ),
                      )
                    }
                  />
                  <span>{genre}</span>
                </label>
              ))}
            </div>
            <label>
              <span>Tags</span>
              <input
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
              />
            </label>
          </section>
        </div>
        <aside className="track-entry-side">
          <div className="release-form-section-header">
            <div>
              <h3>Release appearances</h3>
              <p>Managed from release tracklists.</p>
            </div>
          </div>
          {appearances.length > 0 ? (
            <div className="track-appearance-list">
              {appearances.map((appearance) => (
                <article
                  className="track-appearance-card"
                  key={`${appearance.releaseId}-${appearance.position}`}
                >
                  <strong>{appearance.releaseTitle}</strong>
                  <span>Track {appearance.position}</span>
                  <p>{appearance.releaseArtist}</p>
                  <p>
                    {appearance.year} · {appearance.label}
                  </p>
                  {appearance.versionNote ? (
                    <p>{appearance.versionNote}</p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="release-section-note">
              This track is not attached to a release yet.
            </p>
          )}
        </aside>
      </div>
      <datalist id="track-artist-options">
        {artists.map((artistRecord) => (
          <option key={artistRecord.id} value={artistRecord.name} />
        ))}
      </datalist>
    </ManualEntryPanel>
  )
}

function queryTerms(query: string) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

function trackReleaseAppearances(track: TrackRecord): TrackReleaseAppearance[] {
  if (track.releaseAppearances.length > 0) {
    return track.releaseAppearances
  }

  if (!track.release.id) {
    return []
  }

  return [
    {
      releaseId: track.release.id,
      releaseTitle: track.release.title,
      releaseArtist: track.release.artist,
      year: track.release.year,
      label: track.release.label,
      position: track.trackNumber,
      duration: track.duration,
      versionNote: track.versionHint,
    },
  ]
}

function trackArtistDisplay(track: TrackRecord) {
  const mainArtists = uniqueValues(
    track.credits
      .filter((credit) => credit.role === 'Main artist')
      .map((credit) => credit.artist),
  )
  const creditArtists = uniqueValues(
    track.credits.map((credit) => credit.artist),
  )
  const releaseArtists = uniqueValues(
    trackReleaseAppearances(track).map(
      (appearance) => appearance.releaseArtist,
    ),
  )

  return (
    (mainArtists.length > 0
      ? mainArtists
      : creditArtists.length > 0
        ? creditArtists
        : releaseArtists
    ).join(', ') || 'Unknown artist'
  )
}

function trackReleaseDisplay(track: TrackRecord) {
  const releases = uniqueValues(
    trackReleaseAppearances(track).map((appearance) => appearance.releaseTitle),
  )

  return releases.length > 0 ? releases.join(', ') : 'Unlinked release'
}

function trackVersionDisplay(track: TrackRecord) {
  const appearanceNotes = uniqueValues(
    trackReleaseAppearances(track)
      .map((appearance) => appearance.versionNote)
      .filter((note) => note && !isEmptyVersionNote(note)),
  )

  return appearanceNotes[0] ?? track.versionHint
}

function isEmptyVersionNote(note: string) {
  return note === emptyVersionNote || note === 'No version note recorded'
}

function hasRealLocalFile(track: TrackRecord) {
  const metadata = track.fileMetadata

  return (
    metadata.format !== 'None recorded' &&
    metadata.path !== 'No file linked' &&
    metadata.format.trim().length > 0
  )
}

function trackSearchText(track: TrackRecord) {
  return [
    track.title,
    trackArtistDisplay(track),
    ...trackReleaseAppearances(track).flatMap((appearance) => [
      appearance.releaseTitle,
      appearance.releaseArtist,
      appearance.year,
      appearance.label,
      appearance.position,
      appearance.duration,
      appearance.versionNote,
    ]),
    track.duration,
    trackVersionDisplay(track),
    track.relationHint,
    ...(hasRealLocalFile(track)
      ? [
          track.fileMetadata.format,
          track.fileMetadata.path,
          track.fileMetadata.bitrate,
          track.fileMetadata.sampleRate,
          track.fileMetadata.channels,
        ]
      : []),
    ...track.tags,
    ...track.credits.flatMap((credit) => [
      credit.role,
      credit.artist,
      credit.scope,
    ]),
    ...track.relations.flatMap((relation) => [
      relation.type,
      relation.target,
      relation.detail,
    ]),
  ]
    .join(' ')
    .toLowerCase()
}

function releaseHref(releaseId: string) {
  return `/releases?release=${encodeURIComponent(releaseId)}`
}

type SearchFieldProps = {
  label: string
  placeholder: string
  query: string
  onQueryChange: (query: string) => void
}

function SearchField({
  label,
  placeholder,
  query,
  onQueryChange,
}: SearchFieldProps) {
  return (
    <label className="search-field">
      <span className="search-icon" aria-hidden="true">
        <Search size={17} strokeWidth={2.2} />
      </span>
      <span className="visually-hidden">{label}</span>
      <input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

type TrackTableProps = {
  tracks: TrackRecord[]
  selectedTrackId: string
  onSelectTrack: (trackId: string) => void
}

function TrackTable({
  tracks,
  selectedTrackId,
  onSelectTrack,
}: TrackTableProps) {
  return (
    <section
      className="panel catalog-panel"
      aria-labelledby="track-results-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="track-results-title">Track records</h2>
          <p>
            Tracks connect releases, credits, versions and local file facts.
          </p>
        </div>
      </div>

      <div className="table-scroll">
        <table className="catalog-table workspace-table">
          <thead>
            <tr>
              <th scope="col">Track</th>
              <th scope="col">Artists</th>
              <th scope="col">Releases</th>
              <th scope="col">Duration</th>
              <th scope="col">Version</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((track) => (
              <tr
                key={track.id}
                aria-selected={track.id === selectedTrackId}
                className={
                  track.id === selectedTrackId ? 'is-selected' : undefined
                }
              >
                <th scope="row">
                  <button
                    className="row-title"
                    type="button"
                    onClick={() => onSelectTrack(track.id)}
                  >
                    <strong>{track.title}</strong>
                  </button>
                </th>
                <td data-label="Artists">{trackArtistDisplay(track)}</td>
                <td data-label="Releases">{trackReleaseDisplay(track)}</td>
                <td data-label="Duration">{track.duration}</td>
                <td data-label="Version">{trackVersionDisplay(track)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

type TrackDetailProps = {
  onDelete?: () => void
  onEdit?: () => void
  playlists: PlaylistRecord[]
  relations: RelationRecord[]
  releases: ReleaseRecord[]
  track: TrackRecord
}

function TrackDetail({
  onDelete,
  onEdit,
  playlists,
  relations,
  releases,
  track,
}: TrackDetailProps) {
  const appearances = trackReleaseAppearances(track)
  const trackLink = { kind: 'track', id: track.id } as const
  const linkedRelations = relations.filter(
    (relation) =>
      relationTouchesLink(relation, trackLink) ||
      track.relations.some(
        (trackRelation) =>
          trackRelation.target.toLowerCase() ===
          relation.linkedEntity.toLowerCase(),
      ) ||
      relation.linkedEntity.toLowerCase() === track.title.toLowerCase(),
  )
  const linkedPlaylists = playlists.filter((playlist) =>
    playlistTouchesTrack(playlist, track),
  )

  return (
    <aside className="panel detail-panel" aria-labelledby="track-detail-title">
      <div className="detail-header">
        <div className="detail-title-row">
          <span className="entity-type">Track</span>
          {onEdit ? (
            <span className="badge badge-tag">Editable collection record</span>
          ) : null}
        </div>
        <h2 id="track-detail-title">{track.title}</h2>
        <p>{trackArtistDisplay(track)}</p>
        {onEdit ? (
          <div className="detail-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={onEdit}
            >
              Edit record
            </button>
            {onDelete ? (
              <DeleteSessionRecordButton
                confirmationMessage="Delete this track and remove its release links and credits?"
                onDelete={onDelete}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {track.relationHint ? (
        <p className="detail-summary">{track.relationHint}</p>
      ) : null}

      <section
        className="detail-section"
        aria-labelledby="release-appearances-title"
      >
        <h3 id="release-appearances-title">Release appearances</h3>
        {appearances.length > 0 ? (
          <div className="relation-list">
            {appearances.map((appearance) => {
              const linkedReleaseExists =
                appearance.releaseId &&
                releases.some((release) => release.id === appearance.releaseId)

              return (
                <article key={`${appearance.releaseId}-${appearance.position}`}>
                  <span className="badge badge-credit">
                    Track {appearance.position}
                  </span>
                  {linkedReleaseExists && appearance.releaseId ? (
                    <a
                      className="detail-link"
                      href={releaseHref(appearance.releaseId)}
                    >
                      {appearance.releaseTitle}
                    </a>
                  ) : (
                    <strong>{appearance.releaseTitle}</strong>
                  )}
                  <p>{appearance.releaseArtist}</p>
                  <p>
                    {appearance.year} · {appearance.label} ·{' '}
                    {appearance.duration}
                  </p>
                  {appearance.versionNote ? (
                    <p>{appearance.versionNote}</p>
                  ) : null}
                </article>
              )
            })}
          </div>
        ) : (
          <p>No release appearances recorded.</p>
        )}
      </section>

      <section className="detail-section" aria-labelledby="track-credits-title">
        <h3 id="track-credits-title">Track credits</h3>
        <div className="relation-list">
          {track.credits.map((credit) => (
            <CreditCard
              key={`${credit.role}-${credit.artist}`}
              credit={credit}
            />
          ))}
        </div>
      </section>

      <section
        className="detail-section"
        aria-labelledby="track-relations-title"
      >
        <h3 id="track-relations-title">Versions and relations</h3>
        <div className="relation-list">
          {track.relations.map((relation) => (
            <RelationCard
              key={`${relation.type}-${relation.target}`}
              relation={relation}
            />
          ))}
        </div>
      </section>

      {hasRealLocalFile(track) ? (
        <section className="detail-section" aria-labelledby="track-files-title">
          <h3 id="track-files-title">Local file metadata</h3>
          <FileMetadata metadata={track.fileMetadata} />
        </section>
      ) : null}

      <section className="detail-section" aria-labelledby="track-graph-title">
        <h3 id="track-graph-title">Relation and playlist backlinks</h3>
        {linkedRelations.length > 0 || linkedPlaylists.length > 0 ? (
          <div className="relation-list">
            {linkedRelations.map((relation) => (
              <article key={relation.id}>
                <span className="badge badge-credit">
                  {relation.relationType}
                </span>
                <a
                  className="detail-link"
                  href={`/relations?relation=${encodeURIComponent(relation.id)}`}
                >
                  {relation.source} to {relation.target}
                </a>
                <p>{relation.role}</p>
              </article>
            ))}
            {linkedPlaylists.map((playlist) => (
              <article key={playlist.id}>
                <span className="badge badge-tag">{playlist.type}</span>
                <a
                  className="detail-link"
                  href={`/playlists?playlist=${encodeURIComponent(playlist.id)}`}
                >
                  {playlist.name}
                </a>
                <p>{playlist.description}</p>
              </article>
            ))}
          </div>
        ) : (
          <p>No relation or playlist backlinks yet.</p>
        )}
      </section>
    </aside>
  )
}

type CreditCardProps = {
  credit: TrackCredit
}

function CreditCard({ credit }: CreditCardProps) {
  return (
    <article>
      <span className="badge badge-credit">{credit.role}</span>
      <strong>{credit.artist}</strong>
      {credit.scope ? <p>{credit.scope}</p> : null}
    </article>
  )
}

type RelationCardProps = {
  relation: TrackRelation
}

function RelationCard({ relation }: RelationCardProps) {
  return (
    <article>
      <span className="badge badge-credit">{relation.type}</span>
      <strong>{relation.target}</strong>
      <p>{relation.detail}</p>
    </article>
  )
}

type FileMetadataProps = {
  metadata: LocalFileMetadata
}

function FileMetadata({ metadata }: FileMetadataProps) {
  return (
    <dl className="detail-list">
      <div>
        <dt>Format</dt>
        <dd>{metadata.format}</dd>
      </div>
      <div>
        <dt>Path</dt>
        <dd>{metadata.path}</dd>
      </div>
      <div>
        <dt>Bitrate</dt>
        <dd>{metadata.bitrate}</dd>
      </div>
      <div>
        <dt>Sample rate</dt>
        <dd>{metadata.sampleRate}</dd>
      </div>
      <div>
        <dt>Channels</dt>
        <dd>{metadata.channels}</dd>
      </div>
      <div>
        <dt>Import state</dt>
        <dd>{metadata.importedAt}</dd>
      </div>
      <div>
        <dt>Checksum</dt>
        <dd>{metadata.checksum}</dd>
      </div>
    </dl>
  )
}

function EmptyDetailPanel() {
  return (
    <aside
      className="panel detail-panel empty-detail-panel"
      aria-labelledby="empty-track-detail-title"
      aria-live="polite"
    >
      <div className="detail-header">
        <span className="entity-type">No selection</span>
        <h2 id="empty-track-detail-title">No matching tracks.</h2>
      </div>

      <p className="detail-summary">
        Try another title, artist, release, role, version or file format.
      </p>
    </aside>
  )
}
