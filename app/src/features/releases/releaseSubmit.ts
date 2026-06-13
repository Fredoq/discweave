import { durationPartsToText } from '../catalog/durationFormat'
import { toCreditRole } from '../catalog/creditRoles'
import type { ArtistRecord } from '../artists/artistsData'
import {
  createManualRecordId,
  splitCommaList,
  textOrFallback,
} from '../manualEntry/manualEntryUtils'
import type { TrackRecord } from '../tracks/tracksData'
import type {
  OwnedCopy,
  ReleaseArtistCredit,
  ReleaseLabel,
  ReleaseRecord,
  ReleaseType,
} from './releasesData'
import {
  emptyVersionNote,
  type DraftTrackRow,
  type EditableArtistCredit,
  type EditableReleaseLabel,
} from './ReleaseEntryFormTypes'
import {
  draftTrackPosition,
  isDraftTrackIncluded,
  releaseArtistCreditFromEditableCredit,
  releaseLabelDisplay,
} from './releaseFormHelpers'

type BuildReleaseSubmissionInput = {
  artists: ArtistRecord[]
  draftTracks: DraftTrackRow[]
  effectiveArtistCredits: EditableArtistCredit[]
  effectiveLabels: EditableReleaseLabel[]
  externalSources?: ReleaseRecord['externalSources']
  firstCopy?: OwnedCopy
  genres: string[]
  includeOwnedCopy: boolean
  initialRelease?: ReleaseRecord
  isVariousArtists: boolean
  medium: string
  notOnLabel: boolean
  releaseNotes: string
  releaseDate: string
  status: OwnedCopy['status'] | ''
  tags: string
  title: string
  tracks: TrackRecord[]
  type: ReleaseType
  year: string
}

export function buildReleaseSubmission({
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
}: BuildReleaseSubmissionInput) {
  const releaseTitle = title.trim()
  const resolvedArtistCredits = isVariousArtists
    ? []
    : effectiveArtistCredits
        .map((credit) => releaseArtistCreditFromEditableCredit(credit, artists))
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
        .filter(hasMainArtistRole)
        .map((credit) => credit.artist)
        .join(', ') ||
      resolvedArtistCredits.map((credit) => credit.artist).join(', ')
  const displayLabel = notOnLabel
    ? 'Not On Label'
    : resolvedLabels.map(releaseLabelDisplay).join(', ') || 'Unknown label'
  const firstMainArtist = resolvedArtistCredits.find(hasMainArtistRole)
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
    releaseDate: releaseDate.trim() || undefined,
    label: displayLabel,
    labels: resolvedLabels,
    isVariousArtists,
    notOnLabel,
    genres,
    tags: splitCommaList(tags),
    releaseNotes,
    ownedCopies,
    externalSources,
  }
  const submittedTracks = draftTracks
    .filter(isDraftTrackIncluded)
    .map((track, index): TrackRecord => {
      const trackPosition = draftTrackPosition(
        track,
        index,
        Boolean(initialRelease),
      )
      const disc = textOrUndefined(track.disc)
      const side = textOrUndefined(track.side)
      const resolvedTrackCredits = track.artistCredits
        .map((credit): ReleaseArtistCredit => {
          const existingArtist = artists.find(
            (artist) => artist.id === credit.artistId,
          )
          const roles = credit.roles.length > 0 ? credit.roles : [credit.role]

          return {
            artistId: existingArtist?.id,
            artist: existingArtist?.name ?? credit.artist.trim(),
            role: toCreditRole(roles[0]),
            roles: roles.map(toCreditRole),
          }
        })
        .filter((credit) => credit.artist.length > 0)
      const linkedTrack = track.existingTrackId
        ? tracks.find((candidate) => candidate.id === track.existingTrackId)
        : undefined
      if (linkedTrack) {
        const note = track.versionNote.trim()
        const versionNote = textOrFallback(note, emptyVersionNote)

        return {
          ...linkedTrack,
          inheritReleaseArtistCredits: track.inheritReleaseArtistCredits,
          releaseTrackArtistCredits: releaseArtistCreditsToTrackCredits(
            resolvedTrackCredits,
          ),
          credits: mergedTrackCredits(
            track.inheritReleaseArtistCredits && !isVariousArtists
              ? resolvedArtistCredits.filter(hasMainArtistRole)
              : [],
            [
              ...linkedTrack.credits,
              ...releaseArtistCreditsToTrackCredits(resolvedTrackCredits),
            ],
          ),
          trackNumber: trackPosition,
          disc,
          side,
          versionHint: versionNote,
          relationHint: note,
          releaseAppearances: [
            ...linkedTrack.releaseAppearances.filter(
              (appearance) => appearance.releaseId !== release.id,
            ),
            {
              releaseId: release.id,
              coverImage: release.coverImage,
              releaseTitle: release.title,
              releaseArtist: release.artist,
              year: release.year,
              label: release.label,
              position: trackPosition,
              disc,
              side,
              duration: linkedTrack.duration,
              versionNote,
            },
          ],
        }
      }

      const trackTitle = track.title.trim()
      const effectiveTrackCredits =
        track.inheritReleaseArtistCredits && !isVariousArtists
          ? mergeReleaseArtistCredits([
              ...resolvedArtistCredits.filter(hasMainArtistRole),
              ...resolvedTrackCredits,
            ])
          : resolvedTrackCredits
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
        disc,
        side,
        duration: trackDuration,
        versionHint: textOrFallback(note, emptyVersionNote),
        relationHint: note,
        tags: ['manual entry'],
        inheritReleaseArtistCredits: track.inheritReleaseArtistCredits,
        credits: effectiveTrackCredits.map((credit) => ({
          artistId: credit.artistId,
          role: credit.role,
          roles: credit.roles,
          artist: credit.artist,
          scope: '',
        })),
        releaseAppearances: [
          {
            releaseId: release.id,
            coverImage: release.coverImage,
            releaseTitle: release.title,
            releaseArtist: release.artist,
            year: release.year,
            label: release.label,
            position: trackPosition,
            disc,
            side,
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

  return { release, submittedTracks }
}

function releaseArtistCreditsToTrackCredits(
  credits: ReleaseArtistCredit[],
): TrackRecord['credits'] {
  return credits.map((credit) => ({
    artistId: credit.artistId,
    role: credit.role,
    roles: credit.roles,
    artist: credit.artist,
    scope: '',
  }))
}

function mergeReleaseArtistCredits(credits: ReleaseArtistCredit[]) {
  return [
    ...new Map(
      credits.map((credit) => [
        `${credit.artistId ?? credit.artist}:${(credit.roles ?? [credit.role]).join('|')}`,
        credit,
      ]),
    ).values(),
  ]
}

function mergedTrackCredits(
  inheritedCredits: ReleaseArtistCredit[],
  explicitCredits: TrackRecord['credits'],
) {
  const inheritedTrackCredits = releaseArtistCreditsToTrackCredits(
    inheritedCredits,
  )

  return [
    ...new Map(
      [...inheritedTrackCredits, ...explicitCredits].map((credit) => [
        `${credit.artistId ?? credit.artist}:${(credit.roles ?? [credit.role]).join('|')}`,
        credit,
      ]),
    ).values(),
  ]
}

function textOrUndefined(value: string) {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : undefined
}

function hasMainArtistRole(credit: ReleaseArtistCredit) {
  return (
    credit.roles && credit.roles.length > 0 ? credit.roles : [credit.role]
  ).includes('Main artist')
}
