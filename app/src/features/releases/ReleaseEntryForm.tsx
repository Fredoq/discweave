import { useState } from 'react'
import './releases.css'
import { ManualEntryPanel } from '../manualEntry/ManualEntryPanel'
import { createManualRecordId } from '../manualEntry/manualEntryUtils'
import {
  activeDictionaryLabels,
  type ExternalMetadataReleaseDetailDto,
} from '../catalog/catalogApi'
import {
  durationSecondsToParts,
  emptyDurationParts,
} from '../catalog/durationFormat'
import type { OwnedCopy, ReleaseType } from './releasesData'
import {
  type DraftTrackRow,
  type EditableArtistCredit,
  type EditableReleaseLabel,
  type ReleaseEntryFormProps,
} from './ReleaseEntryFormTypes'
import {
  DiscogsReleaseLookupPanel,
  type DiscogsApplyGroups,
} from './DiscogsReleaseLookupPanel'
import { discogsDraftTrackRows } from './discogsReleaseTrackRows'
import { groupDiscogsCredits } from './discogsReleaseApply'
import { discogsTracklistNeedsVariousArtists } from './discogsRoleUtils'
import { ReleaseArtistCreditsSection } from './ReleaseArtistCreditsSection'
import { ReleaseClassificationSection } from './ReleaseClassificationSection'
import { ReleaseCoreSection } from './ReleaseCoreSection'
import { ReleaseLabelsSection } from './ReleaseLabelsSection'
import { ReleaseOwnedCopySection } from './ReleaseOwnedCopySection'
import { ReleaseTracklistSection } from './ReleaseTracklistSection'
import { buildReleaseSubmission } from './releaseSubmit'
import { useReleaseTrackDrafts } from './useReleaseTrackDrafts'
import {
  artistCreditName,
  isDraftTrackIncluded,
  releaseArtistCreditFromEditableCredit,
} from './releaseFormHelpers'

export function ReleaseEntryForm({
  artists,
  dictionaries,
  initialRelease,
  initialShowDiscogsLookup,
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
          roles:
            credit.roles && credit.roles.length > 0
              ? credit.roles
              : [credit.role],
        }))
      }

      if (initialRelease) {
        return [
          {
            id: createManualRecordId('release-artist-credit', '1'),
            artistId: initialRelease.artistId ?? '',
            artist: initialRelease.artistId ? '' : initialRelease.artist,
            role: 'Main artist',
            roles: ['Main artist'],
          },
        ]
      }

      return []
    },
  )
  const [draftArtist, setDraftArtist] = useState('')
  const [draftArtistId, setDraftArtistId] = useState('')
  const [year, setYear] = useState(initialRelease?.year ?? '')
  const [releaseDate, setReleaseDate] = useState(
    initialRelease?.releaseDate ?? '',
  )
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
  const effectiveReleaseTypeOptions = releaseTypeOptions.includes(type)
    ? releaseTypeOptions
    : [...releaseTypeOptions, type]
  const effectiveGenreOptions = [
    ...genreOptions,
    ...genres.filter((genre) => !genreOptions.includes(genre)),
  ]
  const [includeOwnedCopy, setIncludeOwnedCopy] = useState(Boolean(firstCopy))
  const [medium, setMedium] = useState(firstCopy?.medium ?? '')
  const [status, setStatus] = useState<OwnedCopy['status'] | ''>(
    firstCopy?.status ?? '',
  )
  const [tags, setTags] = useState(initialRelease?.tags.join(', ') ?? '')
  const [releaseNotes] = useState(initialRelease?.releaseNotes ?? '')
  const [externalSources, setExternalSources] = useState(
    initialRelease?.externalSources,
  )
  const [discogsLookupOpenPreference, setDiscogsLookupOpenPreference] =
    useState<boolean | null>(null)
  const isDiscogsLookupOpen =
    discogsLookupOpenPreference ?? Boolean(initialShowDiscogsLookup)
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
    .filter((credit) => hasMainArtistRole(credit) && credit.artist.length > 0)
  const {
    addDraftTrack,
    addTrackArtist,
    clearExistingTrack,
    draftTrackMetaSummary,
    draftTracks,
    duplicateExistingTrackIds,
    handleDraftTrackChange,
    handleDraftTrackDurationChange,
    handleTrackArtistChange,
    handleTrackDraftArtistChange,
    removeDraftTrack,
    removeTrackArtist,
    replaceDraftTracks,
    selectExistingTrack,
    selectedCustomTrackCredits,
    selectedDraftTrack,
    selectedDraftTrackIndex,
    selectedDraftTrackTitleRef,
    selectedExistingTrack,
    selectedExistingTrackSuggestions,
    setSelectedDraftTrackId,
    setTrackArtistMode,
  } = useReleaseTrackDrafts({
    artists,
    initialRelease,
    isVariousArtists,
    releaseMainArtistCredits,
    tracks,
  })

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
      artistCreditName(credit, artists).length > 0 && credit.roles.length === 0,
  )
  const hasUnsetTrackArtistRole = draftTracks.some(
    (track) =>
      isDraftTrackIncluded(track) &&
      !track.existingTrackId &&
      track.artistCredits.some(
        (credit) =>
          artistCreditName(credit, artists).length > 0 &&
          credit.roles.length === 0,
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
  const duplicateRelease = releases.find(
    (release) =>
      release.id !== initialRelease?.id &&
      release.title.toLowerCase() === title.trim().toLowerCase() &&
      release.artist.toLowerCase() === releaseArtist.toLowerCase(),
  )
  const formTitle = initialRelease ? 'Edit release' : 'Add release'

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
        roles: [],
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

  function removeLabelRow(labelId: string) {
    setLabels((currentLabels) =>
      currentLabels.filter((label) => label.id !== labelId),
    )
  }

  function handleSubmit() {
    const { release, submittedTracks } = buildReleaseSubmission({
      artists,
      draftTracks,
      effectiveArtistCredits,
      effectiveLabels,
      externalSources,
      firstCopy,
      genres,
      includeOwnedCopy,
      initialRelease,
      isVariousArtists,
      medium,
      notOnLabel,
      releaseNotes,
      releaseDate,
      status,
      tags,
      title,
      tracks,
      type,
      year,
    })

    onSubmit(release, submittedTracks)
  }

  function handleApplyDiscogsDraft(
    detail: ExternalMetadataReleaseDetailDto,
    groups: DiscogsApplyGroups,
  ) {
    const draft = detail.draft

    if (groups.core) {
      setTitle(draft.title)
      if (draft.type) {
        setType(releaseTypeValueFromCode(draft.type))
      }
      setYear(draft.year?.toString() ?? '')
      if (draft.releaseDate) {
        setReleaseDate(draft.releaseDate)
      }
    }

    if (groups.artists) {
      setIsVariousArtists(false)
      setArtistCredits(
        groupDiscogsCredits(
          draft.artistCredits,
          'release',
          artists,
          dictionaries,
        ),
      )
      setDraftArtist('')
      setDraftArtistId('')
    }

    if (groups.labels) {
      setNotOnLabel(false)
      setDraftLabel('')
      setDraftCatalogNumber('')
      setDraftHasNoCatalogNumber(false)
      setLabels(
        draft.labels.map((label, index) => ({
          id: createManualRecordId('release-label', `discogs-${index + 1}`),
          label: label.name,
          catalogNumber: label.catalogNumber ?? '',
          hasNoCatalogNumber: label.hasNoCatalogNumber,
        })),
      )
    }

    if (groups.classification) {
      setGenres(draft.genres ?? [])
    }

    if (groups.tracklist) {
      const discogsTracks = discogsDraftTrackRows(draft.tracklist)

      if (discogsTracklistNeedsVariousArtists(discogsTracks, draft)) {
        setIsVariousArtists(true)
      }

      replaceDraftTracks(
        discogsTracks.map(
          (track, index): DraftTrackRow => ({
            id: createManualRecordId(
              'draft-track',
              `discogs-${track.position || index + 1}`,
            ),
            existingTrackQuery: '',
            position: String(track.position || index + 1),
            disc: track.disc ?? '',
            side: track.side ?? '',
            title: track.title,
            durationParts: track.durationSeconds
              ? durationSecondsToParts(track.durationSeconds)
              : { ...emptyDurationParts },
            inheritReleaseArtistCredits: track.artistCredits.length === 0,
            artistCredits: groupDiscogsCredits(
              track.artistCredits,
              `track-${index + 1}`,
              artists,
              dictionaries,
            ),
            draftArtist: '',
            draftArtistId: '',
            versionNote: '',
          }),
        ),
      )
    }

    setExternalSources(
      draft.externalSources.map((source) => ({
        ...source,
        appliedAt: new Date().toISOString(),
      })),
    )
  }

  function releaseTypeValueFromCode(code: string) {
    return (
      dictionaries?.releaseType.find((entry) => entry.code === code)?.name ??
      code
    )
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
      <ReleaseCoreSection
        duplicateRelease={duplicateRelease}
        releaseDate={releaseDate}
        releaseTypeOptions={effectiveReleaseTypeOptions}
        setReleaseDate={setReleaseDate}
        setTitle={setTitle}
        setType={setType}
        setYear={setYear}
        title={title}
        type={type}
        year={year}
      />
      <DiscogsReleaseLookupPanel
        current={{
          artists: releaseArtist,
          externalSourceCount: externalSources?.length ?? 0,
          genres: genres.join(', '),
          labels: effectiveLabels
            .map((label) =>
              [label.label, label.catalogNumber].filter(Boolean).join(' '),
            )
            .join(', '),
          releaseDate,
          title,
          trackCount: draftTracks.filter(isDraftTrackIncluded).length,
          year,
        }}
        dictionaries={dictionaries}
        isOpen={isDiscogsLookupOpen}
        mode={initialRelease ? 'update' : 'create'}
        searchSeed={{
          artist: releaseArtist,
          catalogNumber:
            labels.find((label) => label.catalogNumber.trim().length > 0)
              ?.catalogNumber ?? draftCatalogNumber,
          title,
          year: /^\d{4}$/.test(year) ? year : '',
        }}
        onApplyDraft={handleApplyDiscogsDraft}
        onOpenChange={setDiscogsLookupOpenPreference}
      />
      <ReleaseArtistCreditsSection
        addDraftArtistCredit={addDraftArtistCredit}
        artistCredits={artistCredits}
        artists={artists}
        creditRoleOptions={creditRoleOptions}
        draftArtist={draftArtist}
        isVariousArtists={isVariousArtists}
        setArtistCredits={setArtistCredits}
        setDraftArtist={setDraftArtist}
        setDraftArtistId={setDraftArtistId}
        setIsVariousArtists={setIsVariousArtists}
      />
      <ReleaseLabelsSection
        addDraftLabel={addDraftLabel}
        draftCatalogNumber={draftCatalogNumber}
        draftHasNoCatalogNumber={draftHasNoCatalogNumber}
        draftLabel={draftLabel}
        labels={labels}
        notOnLabel={notOnLabel}
        removeLabelRow={removeLabelRow}
        setDraftCatalogNumber={setDraftCatalogNumber}
        setDraftHasNoCatalogNumber={setDraftHasNoCatalogNumber}
        setDraftLabel={setDraftLabel}
        setNotOnLabel={setNotOnLabel}
      />
      <ReleaseClassificationSection
        genreOptions={effectiveGenreOptions}
        genres={genres}
        setGenres={setGenres}
        setTags={setTags}
        tags={tags}
      />
      <ReleaseTracklistSection
        addDraftTrack={addDraftTrack}
        addTrackArtist={addTrackArtist}
        artists={artists}
        clearExistingTrack={clearExistingTrack}
        creditRoleOptions={creditRoleOptions}
        draftTrackMetaSummary={draftTrackMetaSummary}
        draftTracks={draftTracks}
        handleDraftTrackChange={handleDraftTrackChange}
        handleDraftTrackDurationChange={handleDraftTrackDurationChange}
        handleTrackArtistChange={handleTrackArtistChange}
        handleTrackDraftArtistChange={handleTrackDraftArtistChange}
        isVariousArtists={isVariousArtists}
        releaseMainArtistCredits={releaseMainArtistCredits}
        removeDraftTrack={removeDraftTrack}
        removeTrackArtist={removeTrackArtist}
        selectExistingTrack={selectExistingTrack}
        selectedCustomTrackCredits={selectedCustomTrackCredits}
        selectedDraftTrack={selectedDraftTrack}
        selectedDraftTrackIndex={selectedDraftTrackIndex}
        selectedDraftTrackTitleRef={selectedDraftTrackTitleRef}
        selectedExistingTrack={selectedExistingTrack}
        selectedExistingTrackSuggestions={selectedExistingTrackSuggestions}
        setSelectedDraftTrackId={setSelectedDraftTrackId}
        setTrackArtistMode={setTrackArtistMode}
      />
      <ReleaseOwnedCopySection
        includeOwnedCopy={includeOwnedCopy}
        mediaTypeOptions={mediaTypeOptions}
        medium={medium}
        setIncludeOwnedCopy={setIncludeOwnedCopy}
        setMedium={setMedium}
        setStatus={setStatus}
        status={status}
      />
    </ManualEntryPanel>
  )
}

function hasMainArtistRole(credit: { role: string; roles?: string[] }) {
  return (
    credit.roles && credit.roles.length > 0 ? credit.roles : [credit.role]
  ).includes('Main artist')
}
