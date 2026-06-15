import { useState } from 'react'
import './tracks.css'
import { ManualEntryPanel } from '../manualEntry/ManualEntryPanel'
import {
  createManualRecordId,
  textOrFallback,
} from '../manualEntry/manualEntryUtils'
import { uniqueValues } from '../catalog/catalogGraph'
import {
  activeDictionaryLabels,
  type CatalogDictionaries,
} from '../catalog/catalogApi'
import { toCreditRole } from '../catalog/creditRoles'
import {
  durationSecondsToParts,
  durationPartsToText,
  durationTextToParts,
  normalizeDurationPart,
  type DurationParts,
} from '../catalog/durationFormat'
import type { ArtistRecord } from '../artists/artistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import type { ExternalMetadataTrackDetailDto } from '../catalog/catalogApi'
import {
  DiscogsTrackLookupPanel,
  type DiscogsTrackApplyGroups,
} from './DiscogsTrackLookupPanel'
import { CreditRolePicker } from '../releases/CreditRolePicker'
import { TrackClassificationSection } from './TrackClassificationSection'
import {
  trackArtistDisplay,
  trackReleaseAppearances,
  trackReleaseDisplay,
} from './trackDisplayHelpers'
import { groupDiscogsTrackCredits } from './discogsTrackApply'
import type { TrackRecord } from './tracksData'
import { TrackReleaseAppearancesSection } from './TrackReleaseAppearancesSection'

export type TrackEntryFormProps = {
  artists: ArtistRecord[]
  dictionaries: CatalogDictionaries
  initialTrack?: TrackRecord
  initialShowDiscogsLookup?: boolean
  onCancel: () => void
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
  onSubmit: (track: TrackRecord) => void
}

export function TrackEntryForm({
  artists,
  dictionaries,
  initialTrack,
  initialShowDiscogsLookup,
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
      roles:
        credit.roles && credit.roles.length > 0 ? credit.roles : [credit.role],
      id: createManualRecordId(
        'track-credit',
        `${initialTrack?.id ?? 'new'}-${index}`,
      ),
    })),
  )
  const [externalSources, setExternalSources] = useState(
    initialTrack?.externalSources,
  )
  const [discogsLookupOpenPreference, setDiscogsLookupOpenPreference] =
    useState<boolean | null>(null)
  const isDiscogsLookupOpen =
    discogsLookupOpenPreference ?? Boolean(initialShowDiscogsLookup)
  const [appearances] = useState(() =>
    initialTrack ? trackReleaseAppearances(initialTrack) : [],
  )
  const [selectedGenres, setSelectedGenres] = useState(
    initialTrack?.tags.filter((tag) => trackGenreOptions.includes(tag)) ?? [],
  )
  const [tagsText, setTagsText] = useState(
    initialTrack?.tags
      .filter((tag) => !trackGenreOptions.includes(tag))
      .join(', ') ?? '',
  )
  const hasInvalidCredit = credits.some((credit) => credit.roles.length === 0)
  const isValid = title.trim().length > 0 && !hasInvalidCredit
  const candidateArtist = (
    credits.find(hasMainArtistRole)?.artist ??
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
        roles: ['Main artist'],
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
    const normalizedAppearances = appearances.map((appearance) => {
      return {
        releaseId: appearance.releaseId,
        releaseTitle: appearance.releaseTitle,
        releaseArtist: appearance.releaseArtist,
        year: appearance.year,
        label: appearance.label,
        position: appearance.position,
        disc: appearance.disc,
        side: appearance.side,
        duration: textOrFallback(appearance.duration, trackDuration),
      }
    })
    const primaryAppearance = normalizedAppearances[0]
    const primaryCredit = credits.find(hasMainArtistRole) ?? credits[0]
    const existingFileMetadata = initialTrack?.fileMetadata
    const relationHint =
      initialTrack?.relationHint ??
      'Manual track draft with incomplete metadata.'
    const retainedRelations = initialTrack?.relations ?? []
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
      relationHint,
      tags: tags.length > 0 ? tags : ['manual entry'],
      credits: credits.map(({ artistId, artist, role, roles, scope }) => ({
        artistId,
        artist,
        role: toCreditRole(roles[0] ?? role),
        roles: roles.map(toCreditRole),
        scope,
      })),
      releaseAppearances: normalizedAppearances,
      relations: retainedRelations,
      fileMetadata: {
        format: existingFileMetadata?.format ?? 'None recorded',
        path: existingFileMetadata?.path ?? 'No file linked',
        bitrate: existingFileMetadata?.bitrate ?? 'Not recorded',
        sampleRate: existingFileMetadata?.sampleRate ?? 'Not recorded',
        channels: existingFileMetadata?.channels ?? 'Not recorded',
        importedAt: existingFileMetadata?.importedAt ?? 'Manual entry',
        checksum: existingFileMetadata?.checksum ?? 'Not recorded',
      },
      externalSources,
    })
  }

  function handleApplyDiscogsDraft(
    detail: ExternalMetadataTrackDetailDto,
    groups: DiscogsTrackApplyGroups,
  ) {
    if (groups.core) {
      setTitle(detail.draft.title)
      setDurationParts(
        detail.draft.durationSeconds
          ? durationSecondsToParts(detail.draft.durationSeconds)
          : durationTextToParts(''),
      )
    }

    if (groups.credits) {
      setCredits(
        groupDiscogsTrackCredits(
          detail.draft.artistCredits,
          artists,
          dictionaries,
        ),
      )
    }

    setExternalSources(
      detail.draft.externalSources.map((source) => ({
        ...source,
        appliedAt: new Date().toISOString(),
      })),
    )
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
          <DiscogsTrackLookupPanel
            current={{
              artists: credits.map((credit) => credit.artist).join(', '),
              duration: durationPartsToText(durationParts),
              title,
            }}
            dictionaries={dictionaries}
            isOpen={isDiscogsLookupOpen}
            mode={initialTrack ? 'update' : 'create'}
            searchSeed={{
              artist:
                credits.find(hasMainArtistRole)?.artist ??
                credits[0]?.artist ??
                '',
              catalogNumber: initialTrack?.release.catalogNumber ?? '',
              releaseTitle:
                appearances[0]?.releaseTitle ??
                initialTrack?.release.title ??
                '',
              title,
              year: appearances[0]?.year ?? initialTrack?.release.year ?? '',
            }}
            onApplyDraft={handleApplyDiscogsDraft}
            onOpenChange={setDiscogsLookupOpenPreference}
          />
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
                    <span className="release-artist-chip-roles">
                      {credit.roles.map((role, index) => (
                        <span
                          className="release-artist-role-pill"
                          key={`${credit.id}-${role}-${index}`}
                        >
                          <span>{role}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${role} from ${credit.artist}`}
                            onClick={() =>
                              setCredits((currentCredits) =>
                                currentCredits.map((currentCredit) => {
                                  if (currentCredit.id !== credit.id) {
                                    return currentCredit
                                  }

                                  const roles = currentCredit.roles.filter(
                                    (currentRole) => currentRole !== role,
                                  )
                                  return {
                                    ...currentCredit,
                                    role: roles[0] ?? '',
                                    roles,
                                  }
                                }),
                              )
                            }
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <CreditRolePicker
                        addLabel={
                          credit.roles.length > 0 ? 'Add role' : 'Set role'
                        }
                        ariaLabel={`Role for ${credit.artist}`}
                        options={trackCreditRoleOptions.filter(
                          (role) => !credit.roles.includes(role),
                        )}
                        onSelect={(role) => {
                          if (!role || credit.roles.includes(role)) {
                            return
                          }

                          setCredits((currentCredits) =>
                            currentCredits.map((currentCredit) =>
                              currentCredit.id === credit.id
                                ? {
                                    ...currentCredit,
                                    role: currentCredit.role || role,
                                    roles: [...currentCredit.roles, role],
                                  }
                                : currentCredit,
                            ),
                          )
                        }}
                      />
                    </span>
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
          <TrackClassificationSection
            genres={trackGenreOptions}
            selectedGenres={selectedGenres}
            tagsText={tagsText}
            onSelectedGenresChange={setSelectedGenres}
            onTagsTextChange={setTagsText}
          />
        </div>
        <TrackReleaseAppearancesSection appearances={appearances} />
      </div>
      <datalist id="track-artist-options">
        {artists.map((artistRecord) => (
          <option key={artistRecord.id} value={artistRecord.name} />
        ))}
      </datalist>
    </ManualEntryPanel>
  )
}

function hasMainArtistRole(credit: { role: string; roles?: string[] }) {
  return (
    credit.roles && credit.roles.length > 0 ? credit.roles : [credit.role]
  ).includes('Main artist')
}
