import { Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DeleteSessionRecordButton } from '../manualEntry/DeleteSessionRecordButton'
import { ManualEntryPanel } from '../manualEntry/ManualEntryPanel'
import {
  createManualRecordId,
  splitCommaList,
  textOrFallback,
} from '../manualEntry/manualEntryUtils'
import {
  playlistTouchesRelease,
  relationTouchesLink,
  uniqueValues,
} from '../catalog/catalogGraph'
import {
  durationTextToParts,
  durationPartsToText,
  emptyDurationParts,
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
import type { OwnedItemRecord } from '../ownedItems/ownedItemsData'
import type { PlaylistRecord } from '../playlists/playlistsData'
import type { RelationRecord } from '../relations/relationsData'
import type { TrackRecord } from '../tracks/tracksData'
import type {
  OwnedCopy,
  ReleaseArtistCredit,
  ReleaseLabel,
  ReleaseRecord,
  ReleaseType,
} from './releasesData'

type ReleasesWorkspaceProps = {
  artists?: ArtistRecord[]
  isManualEntryOpen?: boolean
  locationSearch?: string
  onAddRelease?: (release: ReleaseRecord, tracks: TrackRecord[]) => void
  onDeleteRelease?: (releaseId: string) => void
  onUpdateRelease?: (release: ReleaseRecord, tracks?: TrackRecord[]) => void
  onManualEntryClose?: () => void
  ownedItems?: OwnedItemRecord[]
  playlists?: PlaylistRecord[]
  releases?: ReleaseRecord[]
  relations?: RelationRecord[]
  tracks?: TrackRecord[]
  dictionaries?: CatalogDictionaries
}

export function ReleasesWorkspace({
  artists = [],
  isManualEntryOpen = false,
  locationSearch = window.location.search,
  onAddRelease,
  onDeleteRelease,
  onUpdateRelease,
  onManualEntryClose = () => {},
  ownedItems = [],
  playlists = [],
  releases: providedReleases,
  relations = [],
  tracks = [],
  dictionaries = defaultCatalogDictionaries,
}: ReleasesWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({
    medium: '',
    label: '',
    year: '',
    tag: '',
  })
  const [manualReleases, setManualReleases] = useState<ReleaseRecord[]>([])
  const [editingReleaseId, setEditingReleaseId] = useState('')
  const releases = useMemo(() => {
    return [...(providedReleases ?? []), ...manualReleases]
  }, [manualReleases, providedReleases])

  const visibleReleases = useMemo(() => {
    const terms = queryTerms(query)

    return releases.filter(
      (release) =>
        terms.every((term) => releaseSearchText(release).includes(term)) &&
        (!filters.medium ||
          release.ownedCopies.some((copy) => copy.medium === filters.medium)) &&
        (!filters.label || releaseHasLabel(release, filters.label)) &&
        (!filters.year || release.year === filters.year) &&
        (!filters.tag ||
          [...release.genres, ...release.tags].includes(filters.tag)),
    )
  }, [filters, query, releases])
  const { selectedRecord: selectedRelease, selectRecord: selectRelease } =
    useCatalogSelection({
      locationSearch,
      queryParam: 'release',
      records: releases,
      routePath: '/releases',
      visibleRecords: visibleReleases,
    })

  function handleAddRelease(
    release: ReleaseRecord,
    createdTracks: TrackRecord[],
  ) {
    if (onAddRelease) {
      onAddRelease(release, createdTracks)
    } else {
      setManualReleases((currentReleases) => [...currentReleases, release])
    }

    setQuery('')
    selectRelease(release.id)
    onManualEntryClose()
  }

  function handleUpdateRelease(release: ReleaseRecord, tracks: TrackRecord[]) {
    if (onUpdateRelease) {
      onUpdateRelease(release, tracks)
    } else {
      setManualReleases((currentReleases) =>
        currentReleases.map((currentRelease) =>
          currentRelease.id === release.id ? release : currentRelease,
        ),
      )
    }

    setQuery('')
    selectRelease(release.id)
    setEditingReleaseId('')
  }

  function handleDeleteRelease(releaseId: string) {
    if (onDeleteRelease) {
      onDeleteRelease(releaseId)
    } else {
      setManualReleases((currentReleases) =>
        currentReleases.filter((release) => release.id !== releaseId),
      )
    }

    setQuery('')
    setEditingReleaseId('')
  }

  const editingRelease = releases.find(
    (release) => release.id === editingReleaseId,
  )

  return (
    <section className="catalog-layout" aria-label="Releases workspace">
      <div className="catalog-main">
        <SearchField
          label="Search releases"
          placeholder="Title, artist, label, catalog number, year, medium or ownership status"
          query={query}
          onQueryChange={setQuery}
        />
        <div className="filter-bar">
          <FilterSelect
            label="Medium"
            value={filters.medium}
            values={uniqueValues(
              releases.flatMap((release) =>
                release.ownedCopies.map((copy) => copy.medium),
              ),
            )}
            onChange={(medium) =>
              setFilters((current) => ({ ...current, medium }))
            }
          />
          <FilterSelect
            label="Label"
            value={filters.label}
            values={uniqueValues(releases.flatMap(releaseLabelNames))}
            onChange={(label) =>
              setFilters((current) => ({ ...current, label }))
            }
          />
          <FilterSelect
            label="Year or date"
            value={filters.year}
            values={uniqueValues(releases.map((release) => release.year))}
            onChange={(year) => setFilters((current) => ({ ...current, year }))}
          />
          <FilterSelect
            label="Tag"
            value={filters.tag}
            values={uniqueValues(
              releases.flatMap((release) => [
                ...release.genres,
                ...release.tags,
              ]),
            )}
            onChange={(tag) => setFilters((current) => ({ ...current, tag }))}
          />
          <span className="result-count">{visibleReleases.length} shown</span>
        </div>
        {isManualEntryOpen ? (
          <ReleaseEntryForm
            artists={artists}
            dictionaries={dictionaries}
            releases={releases}
            tracks={tracks}
            onCancel={onManualEntryClose}
            onSubmit={handleAddRelease}
          />
        ) : null}
        {editingRelease ? (
          <ReleaseEntryForm
            artists={artists}
            dictionaries={dictionaries}
            initialRelease={editingRelease}
            key={editingRelease.id}
            releases={releases}
            tracks={tracks}
            onCancel={() => setEditingReleaseId('')}
            onSubmit={handleUpdateRelease}
          />
        ) : null}
        <ReleaseTable
          releases={visibleReleases}
          selectedReleaseId={selectedRelease?.id ?? ''}
          onSelectRelease={selectRelease}
        />
      </div>

      {selectedRelease ? (
        <ReleaseDetail
          ownedItems={ownedItems}
          onEdit={() => setEditingReleaseId(selectedRelease.id)}
          onDelete={() => handleDeleteRelease(selectedRelease.id)}
          playlists={playlists}
          release={selectedRelease}
          relations={relations}
          tracks={tracks.filter(
            (track) =>
              track.release.id === selectedRelease.id ||
              track.releaseAppearances.some(
                (appearance) => appearance.releaseId === selectedRelease.id,
              ),
          )}
        />
      ) : (
        <EmptyDetailPanel />
      )}
    </section>
  )
}

type ReleaseEntryFormProps = {
  artists: ArtistRecord[]
  dictionaries: CatalogDictionaries
  initialRelease?: ReleaseRecord
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
  onCancel: () => void
  onSubmit: (release: ReleaseRecord, tracks: TrackRecord[]) => void
}

type DraftTrackRow = {
  id: string
  existingTrackId?: string
  existingTrackQuery: string
  position: string
  title: string
  durationParts: DurationParts
  inheritReleaseArtistCredits: boolean
  artistCredits: EditableArtistCredit[]
  draftArtist: string
  draftArtistId: string
  versionNote: string
}

type EditableArtistCredit = {
  id: string
  artistId: string
  artist: string
  role: string
}

type EditableReleaseLabel = {
  id: string
  label: string
  catalogNumber: string
  hasNoCatalogNumber: boolean
}

const emptyVersionNote = 'No version relation recorded'

const releaseYearOptions = Array.from(
  { length: new Date().getFullYear() - 1899 },
  (_, index) => String(new Date().getFullYear() - index),
)

function ReleaseEntryForm({
  artists,
  dictionaries,
  initialRelease,
  releases,
  tracks,
  onCancel,
  onSubmit,
}: ReleaseEntryFormProps) {
  const firstCopy = initialRelease?.ownedCopies[0]
  const [title, setTitle] = useState(initialRelease?.title ?? '')
  const [isVariousArtists, setIsVariousArtists] = useState(
    Boolean(initialRelease?.isVariousArtists),
  )
  const [artistCredits, setArtistCredits] = useState<EditableArtistCredit[]>(
    () => {
      const credits = initialRelease?.artistCredits
      if (credits && credits.length > 0) {
        return credits.map((credit, index) => ({
          id: createManualRecordId('release-artist-credit', `${index}`),
          artistId: credit.artistId ?? '',
          artist: credit.artistId ? '' : credit.artist,
          role: credit.role,
        }))
      }

      if (initialRelease) {
        return [
          {
            id: createManualRecordId('release-artist-credit', '1'),
            artistId: initialRelease.artistId ?? '',
            artist: initialRelease.artistId ? '' : initialRelease.artist,
            role: 'Main artist',
          },
        ]
      }

      return []
    },
  )
  const [draftArtist, setDraftArtist] = useState('')
  const [draftArtistId, setDraftArtistId] = useState('')
  const [year, setYear] = useState(initialRelease?.year ?? '')
  const [notOnLabel, setNotOnLabel] = useState(
    Boolean(initialRelease?.notOnLabel),
  )
  const [labels, setLabels] = useState<EditableReleaseLabel[]>(() => {
    const releaseLabels = initialRelease?.labels
    if (releaseLabels && releaseLabels.length > 0) {
      return releaseLabels.map((label, index) => ({
        id: createManualRecordId('release-label', `${index}`),
        label: label.name,
        catalogNumber: label.catalogNumber ?? '',
        hasNoCatalogNumber: label.hasNoCatalogNumber,
      }))
    }

    if (initialRelease && initialRelease.label !== 'Unknown label') {
      return [
        {
          id: createManualRecordId('release-label', '1'),
          label: initialRelease.label,
          catalogNumber: '',
          hasNoCatalogNumber: false,
        },
      ]
    }

    return []
  })
  const [draftLabel, setDraftLabel] = useState('')
  const [draftCatalogNumber, setDraftCatalogNumber] = useState('')
  const [draftHasNoCatalogNumber, setDraftHasNoCatalogNumber] = useState(false)
  const [genres, setGenres] = useState<string[]>(initialRelease?.genres ?? [])
  const releaseTypeOptions = activeDictionaryLabels(dictionaries, 'releaseType')
  const genreOptions = activeDictionaryLabels(dictionaries, 'genre')
  const creditRoleOptions = activeDictionaryLabels(dictionaries, 'creditRole')
  const mediaTypeOptions = activeDictionaryLabels(dictionaries, 'mediaType')
  const [type, setType] = useState<ReleaseType>(
    initialRelease?.type ?? releaseTypeOptions[0] ?? 'Unknown',
  )
  const [includeOwnedCopy, setIncludeOwnedCopy] = useState(Boolean(firstCopy))
  const [medium, setMedium] = useState(firstCopy?.medium ?? '')
  const [status, setStatus] = useState<OwnedCopy['status'] | ''>(
    firstCopy?.status ?? '',
  )
  const [tags, setTags] = useState(initialRelease?.tags.join(', ') ?? '')
  const [releaseNotes] = useState(initialRelease?.releaseNotes ?? '')
  const initialDraftTracks = useMemo(
    () =>
      initialRelease
        ? draftTracksFromRelease(initialRelease, tracks)
        : ([] as DraftTrackRow[]),
    [initialRelease, tracks],
  )
  const [draftTracks, setDraftTracks] =
    useState<DraftTrackRow[]>(initialDraftTracks)
  const [selectedDraftTrackId, setSelectedDraftTrackId] = useState<
    string | null
  >(initialDraftTracks[0]?.id ?? null)
  const selectedDraftTrackTitleRef = useRef<HTMLInputElement>(null)
  const effectiveArtistCredits = artistCredits
  const draftReleaseLabel: EditableReleaseLabel | undefined =
    draftLabel.trim().length > 0
      ? {
          id: 'draft-release-label',
          label: draftLabel,
          catalogNumber: draftHasNoCatalogNumber ? '' : draftCatalogNumber,
          hasNoCatalogNumber: draftHasNoCatalogNumber,
        }
      : undefined
  const effectiveLabels = draftReleaseLabel
    ? [...labels, draftReleaseLabel]
    : labels
  const releaseMainArtistCredits = effectiveArtistCredits
    .map((credit) => releaseArtistCreditFromEditableCredit(credit, artists))
    .filter(
      (credit) => credit.role === 'Main artist' && credit.artist.length > 0,
    )
  const hasInvalidDraftTrack = draftTracks.some(
    (track) => isDraftTrackIncluded(track) && track.title.trim().length === 0,
  )
  const hasReleaseArtist =
    isVariousArtists ||
    effectiveArtistCredits.some(
      (credit) => artistCreditName(credit, artists).length > 0,
    )
  const hasReleaseLabel =
    notOnLabel || labels.some((label) => label.label.trim().length > 0)
  const hasReleaseGenre = genres.length > 0
  const hasReleaseTracklist =
    (Boolean(initialRelease) && draftTracks.length === 0) ||
    draftTracks.some(isDraftTrackIncluded)
  const hasUnsetReleaseArtistRole = artistCredits.some(
    (credit) =>
      artistCreditName(credit, artists).length > 0 &&
      credit.role.trim().length === 0,
  )
  const hasUnsetTrackArtistRole = draftTracks.some(
    (track) =>
      isDraftTrackIncluded(track) &&
      !track.existingTrackId &&
      track.artistCredits.some(
        (credit) =>
          artistCreditName(credit, artists).length > 0 &&
          credit.role.trim().length === 0,
      ),
  )
  const hasInvalidVariousArtistTrack = draftTracks.some(
    (track) =>
      isVariousArtists &&
      isDraftTrackIncluded(track) &&
      !track.existingTrackId &&
      track.artistCredits.every(
        (credit) => artistCreditName(credit, artists).length === 0,
      ),
  )
  const duplicateExistingTrackIds = duplicateDraftExistingTrackIds(draftTracks)
  const hasDuplicateExistingTrack = duplicateExistingTrackIds.size > 0
  const isValid =
    title.trim().length > 0 &&
    hasReleaseArtist &&
    hasReleaseLabel &&
    hasReleaseGenre &&
    hasReleaseTracklist &&
    !hasUnsetReleaseArtistRole &&
    !hasUnsetTrackArtistRole &&
    !hasInvalidDraftTrack &&
    !hasInvalidVariousArtistTrack &&
    !hasDuplicateExistingTrack
  const requiredMessage =
    title.trim().length === 0
      ? 'Title is required.'
      : !hasReleaseArtist
        ? 'Add at least one release artist or mark this as Various Artists.'
        : hasUnsetReleaseArtistRole
          ? 'Set a role for each release artist.'
          : !hasReleaseLabel
            ? 'Add a label or mark this as Not On Label.'
            : !hasReleaseGenre
              ? 'Select at least one genre.'
              : !hasReleaseTracklist
                ? 'Add at least one tracklist row.'
                : hasUnsetTrackArtistRole
                  ? 'Set a role for each track artist.'
                  : hasInvalidVariousArtistTrack
                    ? 'Track artists are required for Various Artists releases.'
                    : hasDuplicateExistingTrack
                      ? 'Use each existing track only once in this release tracklist.'
                      : 'Tracklist rows with metadata need a track title.'
  const releaseArtist = isVariousArtists
    ? 'Various Artists'
    : effectiveArtistCredits
        .map((credit) => artistCreditName(credit, artists))
        .filter(Boolean)
        .join(', ')
  const selectedDraftTrack =
    draftTracks.find((track) => track.id === selectedDraftTrackId) ??
    draftTracks[0]
  const selectedExistingTrack = selectedDraftTrack?.existingTrackId
    ? tracks.find((track) => track.id === selectedDraftTrack.existingTrackId)
    : undefined
  const unavailableExistingTrackIds = new Set(
    draftTracks
      .filter(
        (track) =>
          track.id !== selectedDraftTrack?.id && Boolean(track.existingTrackId),
      )
      .map((track) => track.existingTrackId ?? ''),
  )
  const selectedExistingTrackSuggestions = selectedDraftTrack
    ? existingTrackSuggestions(
        selectedDraftTrack,
        tracks,
        releaseMainArtistCredits,
      ).filter((track) => !unavailableExistingTrackIds.has(track.id))
    : []
  const selectedDraftTrackIndex = selectedDraftTrack
    ? draftTracks.findIndex((track) => track.id === selectedDraftTrack.id) + 1
    : 0
  const selectedDraftTrackIdForFocus = selectedDraftTrack?.id
  const selectedCustomTrackCredits =
    selectedDraftTrack?.artistCredits.filter(
      (credit) =>
        !releaseMainArtistCredits.some(
          (releaseCredit) =>
            releaseArtistCreditKey(releaseCredit) ===
            editableArtistCreditKey(credit, artists),
        ),
    ) ?? []
  const selectedReleaseArtistKeys = new Set(
    selectedDraftTrack?.artistCredits.map((credit) =>
      editableArtistCreditKey(credit, artists),
    ) ?? [],
  )
  const duplicateRelease = releases.find(
    (release) =>
      release.id !== initialRelease?.id &&
      release.title.toLowerCase() === title.trim().toLowerCase() &&
      release.artist.toLowerCase() === releaseArtist.toLowerCase(),
  )
  const formTitle = initialRelease ? 'Edit release' : 'Add release'

  useEffect(() => {
    if (selectedDraftTrackIdForFocus) {
      selectedDraftTrackTitleRef.current?.focus()
    }
  }, [selectedDraftTrackIdForFocus])

  function addDraftArtistCredit() {
    const artistName = draftArtist.trim()

    if (!artistName && !draftArtistId) {
      return
    }

    setArtistCredits((credits) => [
      ...credits,
      {
        id: createManualRecordId(
          'release-artist-credit',
          String(credits.length + 1),
        ),
        artistId: draftArtistId,
        artist: draftArtistId ? '' : artistName,
        role: '',
      },
    ])
    setDraftArtist('')
    setDraftArtistId('')
  }

  function addDraftLabel() {
    const labelName = draftLabel.trim()

    if (!labelName) {
      return
    }

    setLabels((currentLabels) => [
      ...currentLabels,
      {
        id: createManualRecordId(
          'release-label',
          `${currentLabels.length + 1}`,
        ),
        label: labelName,
        catalogNumber: draftHasNoCatalogNumber ? '' : draftCatalogNumber.trim(),
        hasNoCatalogNumber: draftHasNoCatalogNumber,
      },
    ])
    setDraftLabel('')
    setDraftCatalogNumber('')
    setDraftHasNoCatalogNumber(false)
  }

  function handleSubmit() {
    const releaseTitle = title.trim()
    const resolvedArtistCredits = isVariousArtists
      ? []
      : effectiveArtistCredits
          .map((credit) =>
            releaseArtistCreditFromEditableCredit(credit, artists),
          )
          .filter((credit) => credit.artist.length > 0)
    const resolvedLabels: ReleaseLabel[] = notOnLabel
      ? []
      : effectiveLabels
          .map(
            (label): ReleaseLabel => ({
              name: label.label.trim(),
              catalogNumber: label.catalogNumber.trim() || undefined,
              hasNoCatalogNumber: label.hasNoCatalogNumber,
            }),
          )
          .filter((label) => label.name.length > 0)
    const displayArtist = isVariousArtists
      ? 'Various Artists'
      : resolvedArtistCredits
          .filter((credit) => credit.role === 'Main artist')
          .map((credit) => credit.artist)
          .join(', ') ||
        resolvedArtistCredits.map((credit) => credit.artist).join(', ')
    const displayLabel = notOnLabel
      ? 'Not On Label'
      : resolvedLabels.map(releaseLabelDisplay).join(', ') || 'Unknown label'
    const firstMainArtist = resolvedArtistCredits.find(
      (credit) => credit.role === 'Main artist',
    )
    const copyMedium = medium.trim()
    const copyStatus = status
    const releaseId =
      initialRelease?.id ?? createManualRecordId('release', releaseTitle)
    const ownedCopies: OwnedCopy[] =
      includeOwnedCopy && (copyMedium || copyStatus)
        ? [
            {
              id:
                firstCopy?.id ??
                createManualRecordId('release-copy', releaseTitle),
              medium: textOrFallback(copyMedium, 'Other'),
              status: copyStatus || 'Owned',
              storage: firstCopy?.storage ?? 'No storage recorded',
              condition: firstCopy?.condition ?? 'No condition recorded',
              note: firstCopy?.note ?? '',
            },
            ...(initialRelease?.ownedCopies.slice(1) ?? []),
          ]
        : (initialRelease?.ownedCopies.slice(1) ?? [])
    const release: ReleaseRecord = {
      id: releaseId,
      title: releaseTitle,
      artistId: firstMainArtist?.artistId,
      artist: displayArtist || 'Unknown artist',
      artistCredits: resolvedArtistCredits,
      type,
      year: textOrFallback(year, 'Unknown year'),
      label: displayLabel,
      labels: resolvedLabels,
      isVariousArtists,
      notOnLabel,
      genres,
      tags: splitCommaList(tags),
      releaseNotes,
      ownedCopies,
    }
    const submittedTracks = draftTracks
      .filter(isDraftTrackIncluded)
      .map((track, index): TrackRecord => {
        const trackPosition = draftTrackPosition(
          track,
          index,
          Boolean(initialRelease),
        )
        const linkedTrack = track.existingTrackId
          ? tracks.find((candidate) => candidate.id === track.existingTrackId)
          : undefined
        if (linkedTrack) {
          const note = track.versionNote.trim()
          const versionNote = textOrFallback(note, emptyVersionNote)

          return {
            ...linkedTrack,
            trackNumber: trackPosition,
            versionHint: versionNote,
            relationHint: note,
            releaseAppearances: [
              ...linkedTrack.releaseAppearances.filter(
                (appearance) => appearance.releaseId !== release.id,
              ),
              {
                releaseId: release.id,
                releaseTitle: release.title,
                releaseArtist: release.artist,
                year: release.year,
                label: release.label,
                position: trackPosition,
                duration: linkedTrack.duration,
                versionNote,
              },
            ],
          }
        }

        const trackTitle = track.title.trim()
        const resolvedTrackCredits = track.artistCredits
          .map((credit): ReleaseArtistCredit => {
            const existingArtist = artists.find(
              (artist) => artist.id === credit.artistId,
            )

            return {
              artistId: existingArtist?.id,
              artist: existingArtist?.name ?? credit.artist.trim(),
              role: toCreditRole(credit.role),
            }
          })
          .filter((credit) => credit.artist.length > 0)
        const effectiveTrackCredits =
          !track.inheritReleaseArtistCredits && resolvedTrackCredits.length > 0
            ? resolvedTrackCredits
            : resolvedArtistCredits.filter(
                (credit) => credit.role === 'Main artist',
              )
        const trackArtist =
          effectiveTrackCredits.map((credit) => credit.artist).join(', ') ||
          displayArtist
        const note = track.versionNote.trim()
        const trackDuration = textOrFallback(
          durationPartsToText(track.durationParts),
          'Unknown duration',
        )

        return {
          id: createManualRecordId('track', `${releaseTitle}-${trackTitle}`),
          title: trackTitle,
          artistId: effectiveTrackCredits[0]?.artistId,
          artist: trackArtist,
          release: {
            id: release.id,
            title: release.title,
            artist: release.artist,
            year: release.year,
            label: release.label,
          },
          trackNumber: trackPosition,
          duration: trackDuration,
          versionHint: textOrFallback(note, emptyVersionNote),
          relationHint: note,
          tags: ['manual entry'],
          credits: effectiveTrackCredits.map((credit) => ({
            artistId: credit.artistId,
            role: credit.role,
            artist: credit.artist,
            scope: '',
          })),
          releaseAppearances: [
            {
              releaseId: release.id,
              releaseTitle: release.title,
              releaseArtist: release.artist,
              year: release.year,
              label: release.label,
              position: trackPosition,
              duration: trackDuration,
              versionNote: textOrFallback(note, emptyVersionNote),
            },
          ],
          relations:
            note.length > 0
              ? [
                  {
                    type: 'Version note',
                    target: trackTitle,
                    detail: note,
                  },
                ]
              : [],
          fileMetadata: {
            format: 'None recorded',
            path: 'No file linked',
            bitrate: 'Not recorded',
            sampleRate: 'Not recorded',
            channels: 'Not recorded',
            importedAt: 'Manual entry',
            checksum: 'Not recorded',
          },
        }
      })

    onSubmit(release, submittedTracks)
  }

  function handleDraftTrackChange(
    trackId: string,
    field: 'title' | 'versionNote' | 'existingTrackQuery',
    value: string,
  ) {
    setDraftTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === trackId ? { ...track, [field]: value } : track,
      ),
    )
  }

  function selectExistingTrack(trackId: string, linkedTrack: TrackRecord) {
    setDraftTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              existingTrackId: linkedTrack.id,
              existingTrackQuery: linkedTrack.title,
              title: linkedTrack.title,
              durationParts: durationTextToParts(linkedTrack.duration),
              inheritReleaseArtistCredits: false,
              artistCredits: linkedTrack.credits.map((credit, index) => ({
                id: createManualRecordId(
                  'track-artist-credit',
                  `${linkedTrack.id}-${index + 1}`,
                ),
                artistId: credit.artistId ?? '',
                artist: credit.artistId ? '' : credit.artist,
                role: credit.role,
              })),
              draftArtist: '',
              draftArtistId: '',
            }
          : track,
      ),
    )
  }

  function clearExistingTrack(trackId: string) {
    setDraftTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              existingTrackId: undefined,
              existingTrackQuery: '',
            }
          : track,
      ),
    )
  }

  function handleDraftTrackDurationChange(
    trackId: string,
    field: keyof DurationParts,
    value: string,
    max: number,
  ) {
    const normalizedValue = normalizeDurationPart(value, max)
    if (normalizedValue === null) {
      return
    }

    setDraftTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              durationParts: {
                ...track.durationParts,
                [field]: normalizedValue,
              },
            }
          : track,
      ),
    )
  }

  function handleTrackArtistChange(
    trackId: string,
    creditId: string,
    field: keyof Omit<EditableArtistCredit, 'id'>,
    value: string,
  ) {
    setDraftTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              artistCredits: track.artistCredits.map((credit) =>
                credit.id === creditId ? { ...credit, [field]: value } : credit,
              ),
            }
          : track,
      ),
    )
  }

  function handleTrackDraftArtistChange(trackId: string, nextName: string) {
    const existingArtist = artists.find((artist) => artist.name === nextName)

    setDraftTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              draftArtist: nextName,
              draftArtistId: existingArtist?.id ?? '',
            }
          : track,
      ),
    )
  }

  function addTrackArtist(trackId: string) {
    setDraftTracks((currentTracks) =>
      currentTracks.map((track) => {
        if (track.id !== trackId) {
          return track
        }

        const artistName = track.draftArtist.trim()
        if (!artistName && !track.draftArtistId) {
          return track
        }

        return {
          ...track,
          draftArtist: '',
          draftArtistId: '',
          inheritReleaseArtistCredits: false,
          artistCredits: [
            ...track.artistCredits,
            {
              id: createManualRecordId(
                'track-artist-credit',
                `${track.artistCredits.length + 1}`,
              ),
              artistId: track.draftArtistId,
              artist: track.draftArtistId ? '' : artistName,
              role: '',
            },
          ],
        }
      }),
    )
  }

  function removeTrackArtist(trackId: string, creditId: string) {
    setDraftTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              artistCredits: track.artistCredits.filter(
                (credit) => credit.id !== creditId,
              ),
            }
          : track,
      ),
    )
  }

  function setTrackArtistMode(
    trackId: string,
    inheritReleaseArtistCredits: boolean,
  ) {
    setDraftTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === trackId
          ? {
              ...track,
              inheritReleaseArtistCredits,
              artistCredits: inheritReleaseArtistCredits
                ? []
                : track.artistCredits.length > 0
                  ? track.artistCredits
                  : releaseMainArtistCredits.map((credit, index) =>
                      editableArtistCreditFromReleaseCredit(credit, index),
                    ),
            }
          : track,
      ),
    )
  }

  function toggleReleaseTrackArtist(
    trackId: string,
    credit: ReleaseArtistCredit,
    checked: boolean,
  ) {
    setDraftTracks((currentTracks) =>
      currentTracks.map((track) => {
        if (track.id !== trackId) {
          return track
        }

        const creditKey = releaseArtistCreditKey(credit)
        const otherCredits = track.artistCredits.filter(
          (trackCredit) =>
            editableArtistCreditKey(trackCredit, artists) !== creditKey,
        )

        return {
          ...track,
          inheritReleaseArtistCredits: false,
          artistCredits: checked
            ? [
                ...otherCredits,
                editableArtistCreditFromReleaseCredit(
                  credit,
                  track.artistCredits.length + 1,
                ),
              ]
            : otherCredits,
        }
      }),
    )
  }

  function removeLabelRow(labelId: string) {
    setLabels((currentLabels) =>
      currentLabels.filter((label) => label.id !== labelId),
    )
  }

  function addDraftTrack() {
    const nextPosition = initialRelease
      ? nextDraftTrackPosition(draftTracks)
      : draftTracks.length + 1
    const nextTrack = createDraftTrack(nextPosition)

    setDraftTracks((currentTracks) => [...currentTracks, nextTrack])
    setSelectedDraftTrackId(nextTrack.id)
  }

  function removeDraftTrack(trackId: string) {
    const removedIndex = draftTracks.findIndex((track) => track.id === trackId)
    const retainedTracks = draftTracks.filter((track) => track.id !== trackId)
    const nextTracks = initialRelease
      ? retainedTracks
      : renumberDraftTrackPositions(retainedTracks)

    setDraftTracks(nextTracks)
    if (selectedDraftTrackId === trackId) {
      setSelectedDraftTrackId(
        nextTracks[removedIndex]?.id ??
          nextTracks[removedIndex - 1]?.id ??
          nextTracks[0]?.id ??
          null,
      )
    }
  }

  function createDraftTrack(position: number): DraftTrackRow {
    return {
      id: createManualRecordId('draft-track', String(position)),
      existingTrackQuery: '',
      position: String(position),
      title: '',
      durationParts: { ...emptyDurationParts },
      inheritReleaseArtistCredits: !isVariousArtists,
      artistCredits: [],
      draftArtist: '',
      draftArtistId: '',
      versionNote: '',
    }
  }

  function draftTrackArtistSummary(track: DraftTrackRow) {
    if (track.existingTrackId) {
      const linkedTrack = tracks.find(
        (candidate) => candidate.id === track.existingTrackId,
      )

      return textOrFallback(
        linkedTrack?.artist ??
          track.artistCredits
            .map((credit) => artistCreditName(credit, artists))
            .filter(Boolean)
            .join(', '),
        'Existing track',
      )
    }

    if (track.inheritReleaseArtistCredits && !isVariousArtists) {
      return textOrFallback(
        releaseMainArtistCredits.map((credit) => credit.artist).join(', '),
        'Release main artists',
      )
    }

    return textOrFallback(
      track.artistCredits
        .map((credit) => artistCreditName(credit, artists))
        .filter(Boolean)
        .join(', '),
      'Custom artists',
    )
  }

  function draftTrackMetaSummary(track: DraftTrackRow) {
    return [
      draftTrackArtistSummary(track),
      durationPartsToText(track.durationParts),
      track.versionNote.trim(),
    ]
      .filter(Boolean)
      .join(' · ')
  }

  return (
    <ManualEntryPanel
      title={formTitle}
      requiredMessage={requiredMessage}
      isValid={isValid}
      onCancel={onCancel}
      onSubmit={handleSubmit}
      submitLabel={initialRelease ? 'Save record' : 'Add record'}
    >
      <section className="manual-entry-wide release-form-section release-core-section">
        <div className="release-form-section-header">
          <div>
            <h3>Core</h3>
            <p>Identify the logical release before adding copies.</p>
          </div>
        </div>
        <div className="release-core-grid">
          <label className="release-core-title-field">
            <span>Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>
          <label className="release-core-year-field">
            <span>Year</span>
            <select
              aria-label="Year"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            >
              <option value="">Not recorded</option>
              {releaseYearOptions.map((releaseYear) => (
                <option key={releaseYear}>{releaseYear}</option>
              ))}
            </select>
          </label>
          <label className="release-core-type-field">
            <span>Type</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              {releaseTypeOptions.map((releaseType) => (
                <option key={releaseType}>{releaseType}</option>
              ))}
            </select>
          </label>
        </div>
      </section>
      {duplicateRelease ? (
        <p className="manual-entry-warning manual-entry-wide" role="status">
          Likely duplicate release: {duplicateRelease.title} by{' '}
          {duplicateRelease.artist}. Submit is still allowed for this session.
        </p>
      ) : null}
      <section className="manual-entry-wide release-form-section">
        <div className="release-form-section-header">
          <div>
            <h3>Artists</h3>
            <p>Release credits.</p>
          </div>
          <div className="release-section-actions">
            <label className="compact-checkbox">
              <input
                type="checkbox"
                checked={isVariousArtists}
                onChange={(event) => setIsVariousArtists(event.target.checked)}
              />
              <span>Various Artists</span>
            </label>
          </div>
        </div>
        {isVariousArtists ? (
          <p className="release-section-note">
            Track rows must include their own artists.
          </p>
        ) : (
          <div className="release-artist-editor">
            <div className="release-artist-composer">
              <label className="release-artist-composer-name">
                <span>Artist</span>
                <input
                  aria-label="Release artist"
                  list="release-artist-options"
                  placeholder="Search or type artist"
                  value={draftArtist}
                  onChange={(event) => {
                    const nextName = event.target.value
                    const existingArtist = artists.find(
                      (artist) => artist.name === nextName,
                    )

                    setDraftArtist(nextName)
                    setDraftArtistId(existingArtist?.id ?? '')
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addDraftArtistCredit()
                    }
                  }}
                />
              </label>
              <button
                className="button button-secondary button-compact"
                type="button"
                onClick={addDraftArtistCredit}
              >
                Add artist
              </button>
            </div>
            <div className="release-artist-chip-list" aria-label="Artists">
              {artistCredits.length === 0 ? (
                <p className="release-section-note">
                  Added artists will appear here.
                </p>
              ) : (
                artistCredits.map((credit) => {
                  const artistName = artistCreditName(credit, artists)

                  return (
                    <div className="release-artist-chip" key={credit.id}>
                      <span className="release-artist-chip-name">
                        {artistName || 'Unnamed artist'}
                      </span>
                      <label className="release-artist-chip-role">
                        <span className="visually-hidden">
                          Role for {artistName || 'artist'}
                        </span>
                        <span
                          className={
                            credit.role
                              ? 'release-artist-chip-role-face'
                              : 'release-artist-chip-role-face release-artist-chip-role-face-unset'
                          }
                          aria-hidden="true"
                        >
                          <span>{credit.role || 'Set role'}</span>
                          <span className="release-artist-chip-role-caret" />
                        </span>
                        <select
                          className="release-artist-chip-role-select"
                          aria-label={`Role for ${artistName || 'artist'}`}
                          value={credit.role}
                          onChange={(event) =>
                            setArtistCredits((credits) =>
                              credits.map((currentCredit) =>
                                currentCredit.id === credit.id
                                  ? {
                                      ...currentCredit,
                                      role: event.target.value,
                                    }
                                  : currentCredit,
                              ),
                            )
                          }
                        >
                          <option value="">Set role</option>
                          {creditRoleOptions.map((role) => (
                            <option key={role}>{role}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="release-artist-chip-remove"
                        type="button"
                        aria-label={`Remove ${artistName || 'artist'}`}
                        onClick={() =>
                          setArtistCredits((credits) =>
                            credits.filter(
                              (currentCredit) => currentCredit.id !== credit.id,
                            ),
                          )
                        }
                      >
                        ×
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
        <datalist id="release-artist-options">
          {artists.map((artistRecord) => (
            <option key={artistRecord.id} value={artistRecord.name} />
          ))}
        </datalist>
      </section>
      <section className="manual-entry-wide release-form-section">
        <div className="release-form-section-header">
          <div>
            <h3>Labels</h3>
            <p>Release label credits and catalog numbers.</p>
          </div>
          <div className="release-section-actions">
            <label className="compact-checkbox">
              <input
                type="checkbox"
                checked={notOnLabel}
                onChange={(event) => setNotOnLabel(event.target.checked)}
              />
              <span>Not On Label</span>
            </label>
          </div>
        </div>
        {notOnLabel ? (
          <p className="release-section-note">
            No label rows will be attached to this release.
          </p>
        ) : (
          <div className="release-label-editor">
            <div className="release-label-composer">
              <label className="release-label-composer-name">
                <span>Label</span>
                <input
                  aria-label="Label"
                  placeholder="Search or type label"
                  value={draftLabel}
                  onChange={(event) => setDraftLabel(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addDraftLabel()
                    }
                  }}
                />
              </label>
              <label>
                <span>Catalog number</span>
                <input
                  aria-label="Catalog number"
                  placeholder="CAT-001"
                  value={draftCatalogNumber}
                  disabled={draftHasNoCatalogNumber}
                  onChange={(event) =>
                    setDraftCatalogNumber(event.target.value)
                  }
                />
              </label>
              <label className="compact-checkbox release-row-checkbox">
                <input
                  aria-label="No number"
                  type="checkbox"
                  checked={draftHasNoCatalogNumber}
                  onChange={(event) => {
                    setDraftHasNoCatalogNumber(event.target.checked)
                    if (event.target.checked) {
                      setDraftCatalogNumber('')
                    }
                  }}
                />
                <span>No number</span>
              </label>
              <button
                className="button button-secondary button-compact"
                type="button"
                onClick={addDraftLabel}
              >
                Add label
              </button>
            </div>
            <div className="release-label-chip-list" aria-label="Labels">
              {labels.length === 0 ? (
                <p className="release-section-note">
                  Added labels will appear here.
                </p>
              ) : (
                labels.map((label) => (
                  <div className="release-label-chip" key={label.id}>
                    <span className="release-label-chip-name">
                      {label.label || 'Unnamed label'}
                    </span>
                    <span className="release-label-chip-number">
                      {label.hasNoCatalogNumber
                        ? 'No number'
                        : label.catalogNumber || 'No number'}
                    </span>
                    <button
                      className="release-label-chip-remove"
                      type="button"
                      aria-label={`Remove ${label.label || 'label'}`}
                      onClick={() => removeLabelRow(label.id)}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </section>
      <section className="manual-entry-wide release-form-section">
        <div className="release-form-section-header">
          <div>
            <h3>Classification</h3>
            <p>Genres are broad filters; tags can stay free-form.</p>
          </div>
        </div>
        <fieldset className="genre-chip-fieldset">
          <legend>Genres</legend>
          <div className="genre-chip-list">
            {genreOptions.map((genre) => (
              <label className="genre-chip" key={genre}>
                <input
                  aria-label={`Genre ${genre}`}
                  type="checkbox"
                  checked={genres.includes(genre)}
                  onChange={(event) =>
                    setGenres((currentGenres) =>
                      event.target.checked
                        ? [...currentGenres, genre]
                        : currentGenres.filter((value) => value !== genre),
                    )
                  }
                />
                <span>{genre}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          <span>Tags</span>
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
        </label>
      </section>
      <section
        className="manual-entry-wide release-form-section"
        aria-labelledby="draft-track-section-title"
      >
        <div className="release-form-section-header">
          <div>
            <h3 id="draft-track-section-title">Tracklist</h3>
            <p>Rows create tracks linked to this release.</p>
          </div>
        </div>
        <div className="release-tracklist-editor">
          <div className="release-tracklist-toolbar">
            <div>
              <strong>Tracklist</strong>
              <span>
                {draftTracks.length}{' '}
                {draftTracks.length === 1 ? 'track' : 'tracks'} · selected:{' '}
                {selectedDraftTrack
                  ? `Track ${selectedDraftTrackIndex}`
                  : 'none'}
              </span>
            </div>
            <button
              className="button button-secondary button-compact"
              type="button"
              onClick={addDraftTrack}
            >
              + Track
            </button>
          </div>
          <div
            className={
              selectedDraftTrack
                ? 'release-tracklist-layout'
                : 'release-tracklist-layout release-tracklist-layout-empty'
            }
          >
            <div
              className="release-tracklist-master"
              role="list"
              aria-label="Draft tracklist"
            >
              {draftTracks.length === 0 ? (
                <p className="draft-track-empty">No tracklist rows added.</p>
              ) : (
                draftTracks.map((track, index) => {
                  const rowNumber = index + 1
                  const isSelected = track.id === selectedDraftTrack?.id
                  const trackTitle = textOrFallback(
                    track.title.trim(),
                    `Untitled track ${rowNumber}`,
                  )
                  const trackMeta = draftTrackMetaSummary(track)

                  return (
                    <button
                      aria-label={`Track ${rowNumber} ${trackTitle}${
                        trackMeta ? ` ${trackMeta}` : ''
                      }`}
                      aria-pressed={isSelected}
                      className={
                        isSelected
                          ? 'release-tracklist-master-row is-selected'
                          : 'release-tracklist-master-row'
                      }
                      key={track.id}
                      type="button"
                      onClick={() => setSelectedDraftTrackId(track.id)}
                    >
                      <span className="release-tracklist-master-number">
                        {rowNumber}
                      </span>
                      <span className="release-tracklist-master-copy">
                        <strong>{trackTitle}</strong>
                        <span>{trackMeta || 'No details recorded'}</span>
                      </span>
                      <span className="release-tracklist-master-action">
                        Edit
                      </span>
                    </button>
                  )
                })
              )}
              {draftTracks.length > 0 ? (
                <button
                  className="release-tracklist-master-add"
                  type="button"
                  onClick={addDraftTrack}
                >
                  + Add track
                </button>
              ) : null}
            </div>
            {selectedDraftTrack ? (
              <div className="release-tracklist-detail">
                <div className="release-tracklist-detail-header">
                  <div>
                    <h4>Track {selectedDraftTrackIndex} details</h4>
                    <p>Changes update the selected track row.</p>
                  </div>
                  <div className="release-track-detail-actions">
                    <span className="release-row-index">
                      Track {selectedDraftTrackIndex}
                    </span>
                    <button
                      className="button button-secondary button-compact"
                      type="button"
                      aria-label={`Remove track ${selectedDraftTrackIndex} from tracklist`}
                      onClick={() => removeDraftTrack(selectedDraftTrack.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="existing-track-linker">
                  <label>
                    <span>Existing track</span>
                    <input
                      aria-label="Existing track"
                      placeholder="Search title, artist or release"
                      value={selectedDraftTrack.existingTrackQuery}
                      onChange={(event) =>
                        handleDraftTrackChange(
                          selectedDraftTrack.id,
                          'existingTrackQuery',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  {selectedExistingTrack ? (
                    <div className="existing-track-summary">
                      <span className="badge badge-tag">
                        Linked to existing track
                      </span>
                      <strong>{selectedExistingTrack.title}</strong>
                      <span>
                        {selectedExistingTrack.artist} ·{' '}
                        {selectedExistingTrack.duration}
                      </span>
                      <button
                        className="button button-secondary button-compact"
                        type="button"
                        onClick={() =>
                          clearExistingTrack(selectedDraftTrack.id)
                        }
                      >
                        Clear linked track
                      </button>
                    </div>
                  ) : selectedExistingTrackSuggestions.length > 0 ? (
                    <div
                      className="existing-track-results"
                      aria-label="Existing track suggestions"
                    >
                      {selectedExistingTrackSuggestions.map((track) => (
                        <button
                          key={track.id}
                          type="button"
                          aria-label={`Use existing track ${track.title}`}
                          onClick={() =>
                            selectExistingTrack(selectedDraftTrack.id, track)
                          }
                        >
                          <strong>{track.title}</strong>
                          <span>
                            {track.artist} · {track.release.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : selectedDraftTrack.existingTrackQuery.trim().length >
                    0 ? (
                    <p className="release-section-note">
                      No matching existing tracks.
                    </p>
                  ) : null}
                </div>
                <div className="release-track-detail-grid">
                  <label className="release-track-title-field">
                    <span>Track title</span>
                    <input
                      aria-label="Track title"
                      ref={selectedDraftTrackTitleRef}
                      disabled={Boolean(selectedDraftTrack.existingTrackId)}
                      value={selectedDraftTrack.title}
                      onChange={(event) =>
                        handleDraftTrackChange(
                          selectedDraftTrack.id,
                          'title',
                          event.target.value,
                        )
                      }
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
                          max="99"
                          type="number"
                          disabled={Boolean(selectedDraftTrack.existingTrackId)}
                          value={selectedDraftTrack.durationParts.hours}
                          onChange={(event) =>
                            handleDraftTrackDurationChange(
                              selectedDraftTrack.id,
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
                          disabled={Boolean(selectedDraftTrack.existingTrackId)}
                          value={selectedDraftTrack.durationParts.minutes}
                          onChange={(event) =>
                            handleDraftTrackDurationChange(
                              selectedDraftTrack.id,
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
                          disabled={Boolean(selectedDraftTrack.existingTrackId)}
                          value={selectedDraftTrack.durationParts.seconds}
                          onChange={(event) =>
                            handleDraftTrackDurationChange(
                              selectedDraftTrack.id,
                              'seconds',
                              event.target.value,
                              59,
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>
                  <label className="release-track-version-field">
                    <span>Version note</span>
                    <input
                      aria-label="Version note"
                      value={selectedDraftTrack.versionNote}
                      onChange={(event) =>
                        handleDraftTrackChange(
                          selectedDraftTrack.id,
                          'versionNote',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </div>
                <div className="track-artist-editor">
                  <div className="track-artist-editor-header">
                    <span>Artists</span>
                    {!selectedDraftTrack.existingTrackId &&
                    !isVariousArtists ? (
                      <button
                        className="button button-secondary button-compact"
                        type="button"
                        onClick={() =>
                          setTrackArtistMode(
                            selectedDraftTrack.id,
                            !selectedDraftTrack.inheritReleaseArtistCredits,
                          )
                        }
                      >
                        {selectedDraftTrack.inheritReleaseArtistCredits
                          ? 'Use custom artists'
                          : 'Inherit release artists'}
                      </button>
                    ) : null}
                  </div>
                  {selectedDraftTrack.existingTrackId ? (
                    <div className="track-artist-chip-list">
                      {(
                        selectedExistingTrack?.credits.map(
                          (credit) => credit.artist,
                        ) ??
                        selectedDraftTrack.artistCredits.map((credit) =>
                          artistCreditName(credit, artists),
                        )
                      )
                        .filter(Boolean)
                        .filter(
                          (artistName, index, artistNames) =>
                            artistNames.indexOf(artistName) === index,
                        )
                        .map((artistName) => (
                          <span
                            className="track-artist-chip is-selected"
                            key={artistName}
                          >
                            {artistName}
                          </span>
                        ))}
                    </div>
                  ) : selectedDraftTrack.inheritReleaseArtistCredits &&
                    !isVariousArtists ? (
                    <div className="track-artist-chip-list">
                      {releaseMainArtistCredits.length > 0 ? (
                        releaseMainArtistCredits.map((credit) => (
                          <span
                            className="track-artist-chip is-selected"
                            key={releaseArtistCreditKey(credit)}
                          >
                            {credit.artist}
                          </span>
                        ))
                      ) : (
                        <span className="track-artist-chip">
                          Release main artists
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="track-artist-custom-editor">
                      {releaseMainArtistCredits.length > 0 ? (
                        <fieldset className="track-artist-chip-fieldset">
                          <legend>Release artists</legend>
                          <div className="track-artist-chip-list">
                            {releaseMainArtistCredits.map((credit) => (
                              <label
                                className="track-artist-chip"
                                key={releaseArtistCreditKey(credit)}
                              >
                                <input
                                  aria-label={`Use ${credit.artist} on track`}
                                  checked={selectedReleaseArtistKeys.has(
                                    releaseArtistCreditKey(credit),
                                  )}
                                  type="checkbox"
                                  onChange={(event) =>
                                    toggleReleaseTrackArtist(
                                      selectedDraftTrack.id,
                                      credit,
                                      event.target.checked,
                                    )
                                  }
                                />
                                <span>{credit.artist}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      ) : null}
                      <div className="track-artist-composer">
                        <label>
                          <span>Artist</span>
                          <input
                            aria-label="Track artist"
                            list="release-artist-options"
                            placeholder="Search or type artist"
                            value={selectedDraftTrack.draftArtist}
                            onChange={(event) =>
                              handleTrackDraftArtistChange(
                                selectedDraftTrack.id,
                                event.target.value,
                              )
                            }
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                addTrackArtist(selectedDraftTrack.id)
                              }
                            }}
                          />
                        </label>
                        <button
                          aria-label="Add track artist"
                          className="button button-secondary button-compact"
                          type="button"
                          onClick={() => addTrackArtist(selectedDraftTrack.id)}
                        >
                          Add artist
                        </button>
                      </div>
                      <div
                        className="track-artist-custom-chip-list"
                        aria-label="Track artists"
                      >
                        {selectedCustomTrackCredits.length === 0 ? (
                          <p className="release-section-note">
                            Added track artists will appear here.
                          </p>
                        ) : (
                          selectedCustomTrackCredits.map((credit) => {
                            const artistName = artistCreditName(credit, artists)

                            return (
                              <div
                                className="release-artist-chip"
                                key={credit.id}
                              >
                                <span className="release-artist-chip-name">
                                  {artistName || 'Unnamed artist'}
                                </span>
                                <label className="release-artist-chip-role">
                                  <span className="visually-hidden">
                                    Track role for {artistName || 'artist'}
                                  </span>
                                  <span
                                    className={
                                      credit.role
                                        ? 'release-artist-chip-role-face'
                                        : 'release-artist-chip-role-face release-artist-chip-role-face-unset'
                                    }
                                    aria-hidden="true"
                                  >
                                    <span>{credit.role || 'Set role'}</span>
                                    <span className="release-artist-chip-role-caret" />
                                  </span>
                                  <select
                                    className="release-artist-chip-role-select"
                                    aria-label={`Track role for ${artistName || 'artist'}`}
                                    value={credit.role}
                                    onChange={(event) =>
                                      handleTrackArtistChange(
                                        selectedDraftTrack.id,
                                        credit.id,
                                        'role',
                                        event.target.value,
                                      )
                                    }
                                  >
                                    <option value="">Set role</option>
                                    {creditRoleOptions.map((role) => (
                                      <option key={role}>{role}</option>
                                    ))}
                                  </select>
                                </label>
                                <button
                                  className="release-artist-chip-remove"
                                  type="button"
                                  aria-label={`Remove ${artistName || 'artist'} from track`}
                                  onClick={() =>
                                    removeTrackArtist(
                                      selectedDraftTrack.id,
                                      credit.id,
                                    )
                                  }
                                >
                                  ×
                                </button>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
      <section className="manual-entry-wide release-form-section release-owned-copy-section">
        <div className="release-form-section-header">
          <div>
            <h3>Owned copy</h3>
            <p>Add this only when the collection has a concrete copy.</p>
          </div>
          <label className="compact-checkbox">
            <input
              type="checkbox"
              checked={includeOwnedCopy}
              onChange={(event) => setIncludeOwnedCopy(event.target.checked)}
            />
            <span>Add owned copy</span>
          </label>
        </div>
        {includeOwnedCopy ? (
          <div className="release-owned-copy-grid">
            <label>
              <span>Media</span>
              <select
                value={medium}
                onChange={(event) => setMedium(event.target.value)}
              >
                <option value="">Not recorded</option>
                {mediaTypeOptions.map((mediaType) => (
                  <option key={mediaType}>{mediaType}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Ownership status</span>
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as OwnedCopy['status'] | '')
                }
              >
                <option value="">Not recorded</option>
                <option>Owned</option>
                <option>Wanted</option>
                <option>Sold</option>
                <option>Needs digitization</option>
              </select>
            </label>
          </div>
        ) : null}
      </section>
    </ManualEntryPanel>
  )
}

function isDraftTrackIncluded(track: DraftTrackRow) {
  return (
    Boolean(track.existingTrackId) ||
    [
      track.title,
      durationPartsToText(track.durationParts),
      track.versionNote,
    ].some((value) => value.trim().length > 0) ||
    track.artistCredits.some(
      (credit) => credit.artist.trim().length > 0 || credit.artistId.length > 0,
    )
  )
}

function draftTracksFromRelease(
  release: ReleaseRecord,
  tracks: TrackRecord[],
): DraftTrackRow[] {
  const draftTracks: Array<{
    draftTrack: DraftTrackRow
    position: number
  }> = []

  tracks.forEach((track) => {
    const appearance =
      track.releaseAppearances.find(
        (candidate) => candidate.releaseId === release.id,
      ) ??
      (track.release.id === release.id
        ? {
            position: track.trackNumber,
            duration: track.duration,
            versionNote: track.versionHint,
          }
        : undefined)

    if (!appearance) {
      return
    }

    draftTracks.push({
      draftTrack: {
        id: createManualRecordId('draft-track', `${release.id}-${track.id}`),
        existingTrackId: track.id,
        existingTrackQuery: track.title,
        position: appearance.position,
        title: track.title,
        durationParts: durationTextToParts(appearance.duration),
        inheritReleaseArtistCredits: false,
        artistCredits: track.credits.map((credit, index) => ({
          id: createManualRecordId(
            'track-artist-credit',
            `${track.id}-${index + 1}`,
          ),
          artistId: credit.artistId ?? '',
          artist: credit.artistId ? '' : credit.artist,
          role: credit.role,
        })),
        draftArtist: '',
        draftArtistId: '',
        versionNote: isDefaultVersionNote(appearance.versionNote)
          ? ''
          : appearance.versionNote,
      },
      position: parseDraftTrackPosition(appearance.position),
    })
  })

  return draftTracks
    .sort((first, second) => {
      return first.position - second.position
    })
    .map((track) => track.draftTrack)
}

function draftTrackPosition(
  track: DraftTrackRow,
  index: number,
  preserveStoredPosition: boolean,
) {
  return preserveStoredPosition
    ? track.position.trim() || String(index + 1)
    : String(index + 1)
}

function nextDraftTrackPosition(tracks: DraftTrackRow[]) {
  const numericPositions = tracks
    .map((track) => Number.parseInt(track.position, 10))
    .filter((position) => Number.isFinite(position) && position > 0)

  return numericPositions.length > 0
    ? Math.max(...numericPositions) + 1
    : tracks.length + 1
}

function renumberDraftTrackPositions(tracks: DraftTrackRow[]) {
  return tracks.map((track, index) => ({
    ...track,
    position: String(index + 1),
  }))
}

function duplicateDraftExistingTrackIds(tracks: DraftTrackRow[]) {
  const seenTrackIds = new Set<string>()
  const duplicateTrackIds = new Set<string>()

  tracks.forEach((track) => {
    if (!isDraftTrackIncluded(track) || !track.existingTrackId) {
      return
    }

    if (seenTrackIds.has(track.existingTrackId)) {
      duplicateTrackIds.add(track.existingTrackId)
    } else {
      seenTrackIds.add(track.existingTrackId)
    }
  })

  return duplicateTrackIds
}

function existingTrackSuggestions(
  draftTrack: DraftTrackRow,
  tracks: TrackRecord[],
  releaseMainArtistCredits: ReleaseArtistCredit[],
) {
  const query = normalizeSearchText(draftTrack.existingTrackQuery)
  if (query.length === 0) {
    return []
  }

  const releaseArtistTerms = releaseMainArtistCredits
    .map((credit) => normalizeSearchText(credit.artist))
    .filter(Boolean)

  return tracks
    .filter((track) => existingTrackSearchText(track).includes(query))
    .map((track) => ({
      track,
      priority: releaseArtistTerms.some((artistTerm) =>
        existingTrackArtistText(track).includes(artistTerm),
      )
        ? 0
        : 1,
    }))
    .sort((first, second) => {
      if (first.priority !== second.priority) {
        return first.priority - second.priority
      }

      return first.track.title.localeCompare(second.track.title)
    })
    .slice(0, 5)
    .map(({ track }) => track)
}

function existingTrackSearchText(track: TrackRecord) {
  return normalizeSearchText(
    [
      track.title,
      track.artist,
      track.release.title,
      track.release.artist,
      ...track.credits.map((credit) => credit.artist),
      ...track.releaseAppearances.flatMap((appearance) => [
        appearance.releaseTitle,
        appearance.releaseArtist,
      ]),
    ].join(' '),
  )
}

function existingTrackArtistText(track: TrackRecord) {
  return normalizeSearchText(
    [
      track.artist,
      track.release.artist,
      ...track.credits.map((credit) => credit.artist),
      ...track.releaseAppearances.map((appearance) => appearance.releaseArtist),
    ].join(' '),
  )
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase()
}

function parseDraftTrackPosition(value: string) {
  const parsed = Number.parseInt(value, 10)

  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER
}

function isDefaultVersionNote(value: string) {
  return value.length === 0 || value === emptyVersionNote
}

function editableArtistCreditFromReleaseCredit(
  credit: ReleaseArtistCredit,
  index: number,
): EditableArtistCredit {
  return {
    id: createManualRecordId('track-artist-credit', `${index + 1}`),
    artistId: credit.artistId ?? '',
    artist: credit.artistId ? '' : credit.artist,
    role: credit.role,
  }
}

function releaseArtistCreditFromEditableCredit(
  credit: EditableArtistCredit,
  artists: ArtistRecord[],
): ReleaseArtistCredit {
  const existingArtist = artists.find((artist) => artist.id === credit.artistId)

  return {
    artistId: existingArtist?.id,
    artist: existingArtist?.name ?? credit.artist.trim(),
    role: toCreditRole(credit.role),
  }
}

function releaseArtistCreditKey(credit: ReleaseArtistCredit) {
  return `${credit.artistId ?? credit.artist.toLowerCase()}::${credit.role}`
}

function editableArtistCreditKey(
  credit: EditableArtistCredit,
  artists: ArtistRecord[],
) {
  const artistName = artistCreditName(credit, artists).toLowerCase()

  return `${credit.artistId || artistName}::${credit.role}`
}

function artistCreditName(
  credit: Pick<EditableArtistCredit, 'artist' | 'artistId'>,
  artists: ArtistRecord[],
) {
  if (!credit.artistId) {
    return credit.artist.trim()
  }

  return (
    artists.find((artist) => artist.id === credit.artistId)?.name.trim() ?? ''
  )
}

function releaseLabelDisplay(label: ReleaseLabel) {
  if (label.catalogNumber) {
    return `${label.name} ${label.catalogNumber}`
  }

  if (label.hasNoCatalogNumber) {
    return `${label.name} (No catalog number)`
  }

  return label.name
}

function queryTerms(query: string) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

function releaseSearchText(release: ReleaseRecord) {
  return [
    release.title,
    release.artist,
    release.type,
    release.year,
    release.label,
    release.releaseNotes,
    ...(release.artistCredits?.flatMap((credit) => [
      credit.artist,
      credit.role,
    ]) ?? []),
    ...(release.labels?.flatMap((label) => [
      label.name,
      label.catalogNumber ?? '',
      label.hasNoCatalogNumber ? 'no catalog number' : '',
    ]) ?? []),
    ...release.genres,
    ...release.tags,
    ...release.ownedCopies.flatMap((copy) => [
      copy.medium,
      copy.status,
      copy.storage,
      copy.condition,
      copy.note,
    ]),
  ]
    .join(' ')
    .toLowerCase()
}

function releaseLabelNames(release: ReleaseRecord) {
  return releaseLabelEntries(release).map((label) => label.name)
}

function releaseHasLabel(release: ReleaseRecord, label: string) {
  return releaseLabelNames(release).includes(label)
}

function releaseLabelEntries(release: ReleaseRecord): ReleaseLabel[] {
  const labels =
    release.labels
      ?.map((label) => ({
        ...label,
        catalogNumber: label.catalogNumber?.trim() || undefined,
        name: label.name.trim(),
      }))
      .filter((label) => label.name.length > 0) ?? []

  if (labels.length > 0) {
    return labels
  }

  if (release.label === 'Unknown label') {
    return []
  }

  return [
    {
      name: release.label,
      catalogNumber: undefined,
      hasNoCatalogNumber: false,
    },
  ]
}

function releaseCatalogNumberDisplay(label: ReleaseLabel) {
  if (label.catalogNumber) {
    return label.catalogNumber
  }

  return label.hasNoCatalogNumber ? 'No catalog number' : 'Not recorded'
}

const trackPositionCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

function releaseTrackPosition(track: TrackRecord, release: ReleaseRecord) {
  const releaseAppearance = track.releaseAppearances.find(
    (appearance) => appearance.releaseId === release.id,
  )
  const appearancePosition = releaseAppearance?.position.trim()

  if (appearancePosition) {
    return appearancePosition
  }

  const primaryReleasePosition =
    track.release.id === release.id ? track.trackNumber.trim() : ''

  return primaryReleasePosition || track.trackNumber.trim()
}

function sortReleaseDetailTracks(
  tracks: TrackRecord[],
  release: ReleaseRecord,
) {
  return [...tracks].sort((firstTrack, secondTrack) => {
    const firstPosition = releaseTrackPosition(firstTrack, release)
    const secondPosition = releaseTrackPosition(secondTrack, release)

    if (firstPosition && secondPosition) {
      const positionOrder = trackPositionCollator.compare(
        firstPosition,
        secondPosition,
      )

      if (positionOrder !== 0) {
        return positionOrder
      }
    } else if (firstPosition) {
      return -1
    } else if (secondPosition) {
      return 1
    }

    return trackPositionCollator.compare(firstTrack.title, secondTrack.title)
  })
}

function releaseDetailSummary(release: ReleaseRecord) {
  const summary = release.releaseNotes.trim()

  return isTechnicalApiSummary(summary) ? '' : summary
}

function isTechnicalApiSummary(summary: string) {
  const normalized = summary.toLowerCase()

  return (
    normalized.includes('loaded') &&
    normalized.includes('authenticated') &&
    normalized.includes('collection') &&
    normalized.includes('api')
  )
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

type ReleaseTableProps = {
  releases: ReleaseRecord[]
  selectedReleaseId: string
  onSelectRelease: (releaseId: string) => void
}

function ReleaseTable({
  releases,
  selectedReleaseId,
  onSelectRelease,
}: ReleaseTableProps) {
  return (
    <section
      className="panel catalog-panel"
      aria-labelledby="release-results-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="release-results-title">Release records</h2>
          <p>Logical releases stay separate from concrete owned copies.</p>
        </div>
      </div>

      <div className="table-scroll">
        <table className="catalog-table workspace-table releases-table">
          <thead>
            <tr>
              <th scope="col">Release</th>
              <th scope="col">Artist</th>
              <th scope="col">Year</th>
              <th scope="col">Label</th>
              <th scope="col">Catalog #</th>
              <th scope="col">Media</th>
              <th scope="col">Ownership</th>
            </tr>
          </thead>
          <tbody>
            {releases.map((release) => (
              <tr
                key={release.id}
                aria-selected={release.id === selectedReleaseId}
                className={
                  release.id === selectedReleaseId ? 'is-selected' : undefined
                }
              >
                <th scope="row">
                  <button
                    className="row-title"
                    type="button"
                    onClick={() => onSelectRelease(release.id)}
                  >
                    <strong>{release.title}</strong>
                    <span>{release.type}</span>
                  </button>
                </th>
                <td data-label="Artist">{release.artist}</td>
                <td data-label="Year">{release.year}</td>
                <td data-label="Label">
                  <ReleaseLabelsCell release={release} />
                </td>
                <td data-label="Catalog #">
                  <ReleaseCatalogNumbersCell release={release} />
                </td>
                <td data-label="Media">
                  <BadgeList
                    values={[
                      ...new Set(
                        release.ownedCopies.map((copy) => copy.medium),
                      ),
                    ]}
                    variant="media"
                  />
                </td>
                <td data-label="Ownership">
                  <BadgeList
                    values={[
                      ...new Set(
                        release.ownedCopies.map((copy) => copy.status),
                      ),
                    ]}
                    variant="tag"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ReleaseLabelsCell({ release }: { release: ReleaseRecord }) {
  const labels = releaseLabelEntries(release)

  if (labels.length === 0) {
    return <span className="release-table-empty">Unknown label</span>
  }

  return (
    <span className="release-label-stack">
      {labels.map((label, index) => (
        <span
          className="release-label-name"
          key={`${label.name}-${label.catalogNumber ?? index}`}
        >
          {label.name}
        </span>
      ))}
    </span>
  )
}

function ReleaseCatalogNumbersCell({ release }: { release: ReleaseRecord }) {
  const labels = releaseLabelEntries(release)

  if (labels.length === 0) {
    return <span className="release-table-empty">Not recorded</span>
  }

  return (
    <span className="release-catalog-stack">
      {labels.map((label, index) => {
        const catalogNumber = releaseCatalogNumberDisplay(label)

        return (
          <span
            className={
              label.catalogNumber
                ? 'release-catalog-number'
                : 'release-catalog-number release-catalog-number-empty'
            }
            key={`${label.name}-${catalogNumber}-${index}`}
          >
            {catalogNumber}
          </span>
        )
      })}
    </span>
  )
}

type ReleaseDetailProps = {
  ownedItems: OwnedItemRecord[]
  onDelete?: () => void
  onEdit?: () => void
  playlists: PlaylistRecord[]
  release: ReleaseRecord
  relations: RelationRecord[]
  tracks: TrackRecord[]
}

function ReleaseDetail({
  ownedItems,
  onDelete,
  onEdit,
  playlists,
  release,
  relations,
  tracks,
}: ReleaseDetailProps) {
  const releaseLink = { kind: 'release', id: release.id } as const
  const linkedOwnedItems = ownedItems.filter(
    (item) =>
      item.releaseId === release.id ||
      (item.releaseTitle.toLowerCase() === release.title.toLowerCase() &&
        item.artist.toLowerCase() === release.artist.toLowerCase()),
  )
  const linkedRelations = relations.filter(
    (relation) =>
      relationTouchesLink(relation, releaseLink) ||
      relation.source.toLowerCase() === release.title.toLowerCase() ||
      relation.target.toLowerCase() === release.title.toLowerCase() ||
      relation.linkedEntity.toLowerCase() === release.title.toLowerCase(),
  )
  const linkedPlaylists = playlists.filter((playlist) =>
    playlistTouchesRelease(playlist, release),
  )
  const sortedTracks = useMemo(
    () => sortReleaseDetailTracks(tracks, release),
    [release, tracks],
  )
  const summary = releaseDetailSummary(release)

  return (
    <aside
      className="panel detail-panel"
      aria-labelledby="release-detail-title"
    >
      <div className="detail-header">
        <div className="detail-title-row">
          <span className="entity-type">{release.type}</span>
          {onEdit ? (
            <span className="badge badge-tag">Editable collection record</span>
          ) : null}
        </div>
        <h2 id="release-detail-title">{release.title}</h2>
        <p>{release.artist}</p>
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
                confirmationMessage="Delete this release and unused linked tracks?"
                onDelete={onDelete}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {summary ? <p className="detail-summary">{summary}</p> : null}

      <section
        className="detail-section"
        aria-labelledby="release-metadata-title"
      >
        <h3 id="release-metadata-title">Release metadata</h3>
        <dl className="detail-list">
          <div>
            <dt>Artist</dt>
            <dd>{release.artist}</dd>
          </div>
          <div>
            <dt>Year</dt>
            <dd>{release.year}</dd>
          </div>
          <ReleaseLabelMetadata release={release} />
          <div>
            <dt>Genres and tags</dt>
            <dd>
              <BadgeList
                values={[...release.genres, ...release.tags]}
                variant="tag"
              />
            </dd>
          </div>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="release-owned-title">
        <h3 id="release-owned-title">Owned copies</h3>
        <div className="copy-list">
          {release.ownedCopies.map((copy) => (
            <OwnedCopyCard key={copy.id} copy={copy} />
          ))}
        </div>
      </section>

      <section
        className="detail-section"
        aria-labelledby="release-tracks-title"
      >
        <h3 id="release-tracks-title">Tracks</h3>
        {sortedTracks.length > 0 ? (
          <div className="relation-list">
            <p>
              {sortedTracks.length}{' '}
              {sortedTracks.length === 1 ? 'track' : 'tracks'}
            </p>
            {sortedTracks.map((track) => {
              const position = releaseTrackPosition(track, release)

              return (
                <article key={track.id}>
                  <a className="detail-link" href={trackHref(track.id)}>
                    {track.title}
                  </a>
                  <p>
                    {position || 'Unnumbered'} · {track.artist} ·{' '}
                    {track.duration}
                  </p>
                </article>
              )
            })}
          </div>
        ) : (
          <p>No tracks linked yet.</p>
        )}
      </section>

      <section className="detail-section" aria-labelledby="release-owned-items">
        <h3 id="release-owned-items">Owned item backlinks</h3>
        {linkedOwnedItems.length > 0 ? (
          <div className="relation-list">
            {linkedOwnedItems.map((item) => (
              <article key={item.id}>
                <span className="badge badge-media">{item.medium}</span>
                <a
                  className="detail-link"
                  href={`/owned-items?ownedItem=${encodeURIComponent(item.id)}`}
                >
                  {item.title}
                </a>
                <p>
                  {item.status} · {item.storage} · {item.condition}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p>No owned items point back to this release yet.</p>
        )}
      </section>

      <section className="detail-section" aria-labelledby="release-graph-links">
        <h3 id="release-graph-links">Relations and playlist appearances</h3>
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

function ReleaseLabelMetadata({ release }: { release: ReleaseRecord }) {
  const labels = releaseLabelEntries(release)

  return (
    <div>
      <dt className="visually-hidden">Labels</dt>
      <dd>
        {labels.length === 0 ? (
          <span className="release-table-empty">Unknown label</span>
        ) : (
          <span
            className="release-label-metadata-table"
            aria-label="Labels and catalog numbers"
          >
            <span className="release-label-metadata-heading" aria-hidden="true">
              <span>Label</span>
              <span>Catalog number</span>
            </span>
            {labels.map((label, index) => {
              const catalogNumber = releaseCatalogNumberDisplay(label)

              return (
                <span
                  className="release-label-metadata-row"
                  key={`${label.name}-${catalogNumber}-${index}`}
                >
                  <span className="release-label-metadata-name">
                    {label.name}
                  </span>
                  <span
                    className={
                      label.catalogNumber
                        ? 'release-label-metadata-catalog'
                        : 'release-label-metadata-catalog release-catalog-number-empty'
                    }
                  >
                    {catalogNumber}
                  </span>
                </span>
              )
            })}
          </span>
        )}
      </dd>
    </div>
  )
}

function trackHref(trackId: string) {
  return `/tracks?track=${encodeURIComponent(trackId)}`
}

type OwnedCopyCardProps = {
  copy: OwnedCopy
}

function OwnedCopyCard({ copy }: OwnedCopyCardProps) {
  return (
    <article className="copy-card">
      <div>
        <strong>{copy.medium}</strong>
        <span className="badge badge-tag">{copy.status}</span>
      </div>
      <dl className="detail-list">
        <div>
          <dt>Storage</dt>
          <dd>{copy.storage}</dd>
        </div>
        <div>
          <dt>Condition</dt>
          <dd>{copy.condition}</dd>
        </div>
      </dl>
      {copy.note ? <p>{copy.note}</p> : null}
    </article>
  )
}

function EmptyDetailPanel() {
  return (
    <aside
      className="panel detail-panel empty-detail-panel"
      aria-labelledby="empty-release-detail-title"
      aria-live="polite"
    >
      <div className="detail-header">
        <span className="entity-type">No selection</span>
        <h2 id="empty-release-detail-title">No matching releases.</h2>
      </div>

      <p className="detail-summary">
        Try another title, artist, label, medium or ownership status.
      </p>
    </aside>
  )
}

type BadgeListProps = {
  values: string[]
  variant: 'media' | 'tag'
}

function BadgeList({ values, variant }: BadgeListProps) {
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
