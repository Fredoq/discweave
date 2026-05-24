import { useMemo, useState } from 'react'
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
  durationPartsToText,
  durationTextToParts,
  normalizeDurationPart,
  type DurationParts,
} from '../catalog/durationFormat'
import type { ArtistRecord } from '../artists/artistsData'
import type { ReleaseRecord } from '../releases/releasesData'
import {
  emptyVersionNote,
  trackArtistDisplay,
  trackReleaseAppearances,
  trackReleaseDisplay,
} from './trackDisplayHelpers'
import type { TrackRecord } from './tracksData'

export type TrackEntryFormProps = {
  artists: ArtistRecord[]
  dictionaries: CatalogDictionaries
  initialTrack?: TrackRecord
  onCancel: () => void
  releases: ReleaseRecord[]
  tracks: TrackRecord[]
  onSubmit: (track: TrackRecord) => void
}

export function TrackEntryForm({
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
