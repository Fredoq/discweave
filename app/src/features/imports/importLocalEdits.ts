import { loadRelease, type ReleaseImportDraft } from '../catalog/catalogApi'
import type { LocalEditableFile } from '../localFiles/localFileEditModel'
import { normalizePath, hasTagValues } from '../localFiles/localFileEditHelpers'
import {
  partialApplyError,
  partialApplyStatus,
  reconcileCatalogFiles,
} from '../localFiles/localFileEditApplyResult'
import type { StagedLocalEdit } from '../localFiles/localFileEditTypes'
import {
  effectiveDraftArtistCredits,
  effectiveDraftLabels,
} from './importHelpers'

export type StagedLocalEditOutcome =
  | { kind: 'applied'; releaseId: string }
  | { kind: 'failed'; releaseId: string; message: string }

const storageKeyPrefix = 'discweave.importLocalEdits.'

// ponytail: the staged plan lives in browser storage on this device, not in the
// import session; move it to a draft column when plans must survive a reset.
export function loadStagedLocalEdits(draftId: string): StagedLocalEdit[] {
  try {
    const stored = window.localStorage.getItem(storageKeyPrefix + draftId)
    const parsed: unknown = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? (parsed as StagedLocalEdit[]) : []
  } catch {
    return []
  }
}

export function saveStagedLocalEdits(
  draftId: string,
  edits: StagedLocalEdit[],
) {
  try {
    if (edits.length === 0) {
      window.localStorage.removeItem(storageKeyPrefix + draftId)
    } else {
      window.localStorage.setItem(
        storageKeyPrefix + draftId,
        JSON.stringify(edits),
      )
    }
  } catch {
    // Storage can be unavailable; the plan then only lives until the editor closes.
  }
}

export function importEditableFiles(
  draft: ReleaseImportDraft,
  staged: StagedLocalEdit[],
): LocalEditableFile[] {
  const stagedByPath = new Map(
    staged.map((edit) => [normalizePath(edit.currentPath), edit]),
  )
  const releaseArtists = uniqueNames(
    effectiveDraftArtistCredits(draft).filter(isMainArtistCredit),
  )
  const label = effectiveDraftLabels(draft)[0]
  const year = draft.year ? String(draft.year) : ''
  const release = {
    title: draft.title,
    artists: releaseArtists.join(', '),
    year,
    releaseDate: draft.releaseDate ?? undefined,
    label: label?.name ?? '',
    catalogNumber: label?.catalogNumber ?? draft.catalogNumber ?? undefined,
  }

  return draft.tracks.flatMap((track) => {
    if (track.sourceKind !== 'localFiles' || track.isSkipped) {
      return []
    }

    const trackArtists = draftTrackArtists(track, releaseArtists)
    const position = track.position ? String(track.position) : ''
    const edit = stagedByPath.get(normalizePath(track.filePath))

    return [
      {
        rowId: track.id,
        localAudioFileId: '',
        title: track.title,
        position,
        disc: track.disc ?? undefined,
        trackArtists: trackArtists.join(', '),
        currentPath: track.filePath,
        targetPath: edit?.targetPath ?? track.filePath,
        release,
        tags: {
          title: track.title,
          artists: trackArtists,
          album: draft.title,
          albumArtists: releaseArtists,
          trackNumber: track.position ?? null,
          date: draft.releaseDate || year || null,
          year: draft.year ?? null,
          genre: draft.genres.slice(0, 1),
          label: release.label || null,
          catalogNumber: release.catalogNumber ?? null,
        },
        targetTags: edit?.targetTags,
      },
    ]
  })
}

export async function applyStagedLocalEdits(
  releaseId: string,
  staged: StagedLocalEdit[],
): Promise<StagedLocalEditOutcome> {
  const bridge = window.discweaveDesktop?.localEdits
  if (!bridge) {
    return failed(releaseId, 'Local file editing is only available on desktop.')
  }

  const release = await loadRelease(releaseId)
  const fileIdsByPath = new Map(
    (release?.tracklist ?? []).flatMap((track) =>
      (track.linkedLocalFiles ?? []).map((file) => [
        normalizePath(file.path),
        file.localAudioFileId,
      ]),
    ),
  )
  const files = staged.flatMap((edit) => {
    const localAudioFileId = fileIdsByPath.get(normalizePath(edit.currentPath))
    if (!localAudioFileId) {
      return []
    }

    return [
      {
        localAudioFileId,
        currentPath: edit.currentPath,
        targetPath: edit.targetPath,
        ...(hasTagValues(edit.tagChanges) ? { tags: edit.tagChanges } : {}),
      },
    ]
  })
  if (files.length < staged.length) {
    return failed(
      releaseId,
      'Some staged files are not linked to the release. Nothing was written.',
    )
  }

  const result = await bridge.apply({ files })
  const catalogFailures = await reconcileCatalogFiles(result.files)
  if (!result.applied || catalogFailures.length > 0) {
    const status = partialApplyStatus(result, catalogFailures.length)
    const error = partialApplyError(result, catalogFailures.length)
    const issues = (result.changes ?? []).flatMap((change) =>
      change.issues
        .filter((issue) => issue.severity === 'error')
        .map((issue) => `${fileNameOf(change.currentPath)}: ${issue.message}`),
    )
    return failed(
      releaseId,
      [error, status, ...issues].filter(Boolean).join(' '),
    )
  }

  return { kind: 'applied', releaseId }
}

export function openReleaseInCatalog(releaseId: string) {
  window.history.pushState(
    {},
    '',
    `/releases?release=${encodeURIComponent(releaseId)}`,
  )
  window.dispatchEvent(new Event('discweave:navigation'))
}

// Mirrors trackArtistDisplay on the Releases tab: main artists only, then any
// credited artist, then the release artists.
function draftTrackArtists(
  track: ReleaseImportDraft['tracks'][number],
  releaseArtists: string[],
) {
  const credits =
    track.artistCredits ??
    track.artistNames.map((name) => ({ name, role: 'mainArtist' }))
  const inherited =
    track.inheritReleaseArtistCredits === false ? [] : releaseArtists
  const mainArtists = [
    ...new Set([
      ...inherited,
      ...uniqueNames(credits.filter(isMainArtistCredit)),
    ]),
  ]
  if (mainArtists.length > 0) {
    return mainArtists
  }

  const creditedArtists = uniqueNames(credits)
  return creditedArtists.length > 0 ? creditedArtists : releaseArtists
}

function isMainArtistCredit(credit: { role: string }) {
  return (
    credit.role === 'mainArtist' || credit.role.toLowerCase() === 'main artist'
  )
}

function uniqueNames(credits: readonly { name: string }[]) {
  return [
    ...new Set(credits.map((credit) => credit.name.trim()).filter(Boolean)),
  ]
}

function fileNameOf(filePath: string) {
  return filePath.split(/[\\/]/).pop() ?? filePath
}

function failed(releaseId: string, message: string): StagedLocalEditOutcome {
  return { kind: 'failed', releaseId, message }
}

// Applies staged edits, then reloads the catalog so it sees the renamed paths.
export async function finishConfirmedImport(
  draftId: string,
  releaseId: string,
  onCatalogChanged: () => void,
): Promise<StagedLocalEditOutcome> {
  const staged = loadStagedLocalEdits(draftId)
  let outcome: StagedLocalEditOutcome = { kind: 'applied', releaseId }
  try {
    if (staged.length > 0) {
      outcome = await applyStagedLocalEdits(releaseId, staged)
    }
  } catch (error) {
    outcome = failed(
      releaseId,
      error instanceof Error ? error.message : 'Local file changes failed.',
    )
  }

  onCatalogChanged()
  if (outcome.kind === 'applied') {
    saveStagedLocalEdits(draftId, [])
    openReleaseInCatalog(releaseId)
  }

  return outcome
}
