import {
  defaultCatalogDictionaries,
  type CatalogDictionaries,
  type DictionaryEntry,
  type ReleaseImportArtistCredit,
  type ReleaseImportDraft,
  type ReleaseImportDraftTrack,
  type ReleaseImportLabel,
} from '../catalog/catalogApi'
import type { ArtistRecord } from '../artists/artistsData'

export function cloneDraft(draft: ReleaseImportDraft): ReleaseImportDraft {
  return {
    ...draft,
    artistNames: [...draft.artistNames],
    artistCredits: (draft.artistCredits ?? []).map((credit) => ({ ...credit })),
    labels: (draft.labels ?? []).map((label) => ({ ...label })),
    externalSources: (draft.externalSources ?? []).map((source) => ({
      ...source,
    })),
    selectedArtistIds: [...draft.selectedArtistIds],
    tracks: draft.tracks.map((track) => ({
      ...track,
      artistNames: [...track.artistNames],
      artistCredits: (track.artistCredits ?? []).map((credit) => ({
        ...credit,
      })),
      inheritReleaseArtistCredits: Boolean(track.inheritReleaseArtistCredits),
      selectedArtistIds: [...track.selectedArtistIds],
    })),
  }
}

export function draftIsValid(draft: ReleaseImportDraft) {
  return draftValidationMessage(draft) === ''
}

export function draftValidationMessage(draft: ReleaseImportDraft) {
  const artistCredits = effectiveDraftArtistCredits(draft)
  const labels = effectiveDraftLabels(draft)

  if (!draft.title.trim()) {
    return 'Release title is required.'
  }

  if (
    !draft.isVariousArtists &&
    artistCredits.every((credit) => !credit.artistId && !credit.name.trim())
  ) {
    return 'Release artist is required unless this is Various Artists.'
  }

  if (
    !draft.isVariousArtists &&
    artistCredits.some(
      (credit) =>
        (credit.artistId || credit.name.trim()) && !credit.role.trim(),
    )
  ) {
    return 'Every release artist needs a role.'
  }

  if (
    !draft.notOnLabel &&
    labels.every((label) => !label.labelId && !label.name.trim())
  ) {
    return 'Label is required unless Not on label is selected.'
  }

  if (draft.tracks.some((track) => !track.isSkipped && !track.title.trim())) {
    return 'Every included track needs a title.'
  }

  if (
    draft.isVariousArtists &&
    draft.tracks.some(
      (track) =>
        !track.isSkipped &&
        effectiveTrackArtistCredits(track).every(
          (credit) => !credit.artistId && !credit.name.trim(),
        ),
    )
  ) {
    return 'Every included track needs at least one artist for Various Artists releases.'
  }

  if (
    draft.tracks.some((track) =>
      effectiveTrackArtistCredits(track).some(
        (credit) =>
          (credit.artistId || credit.name.trim()) && !credit.role.trim(),
      ),
    )
  ) {
    return 'Every track artist needs a role.'
  }

  return ''
}

export function effectiveDraftArtistCredits(draft: ReleaseImportDraft) {
  if (draft.artistCredits && draft.artistCredits.length > 0) {
    return draft.artistCredits
  }

  return draft.artistNames.map(
    (name, index): ReleaseImportArtistCredit => ({
      artistId: draft.selectedArtistIds[index] ?? null,
      name,
      role: 'mainArtist',
    }),
  )
}

export function effectiveDraftLabels(draft: ReleaseImportDraft) {
  if (draft.labels && draft.labels.length > 0) {
    return draft.labels
  }

  return draft.labelName?.trim()
    ? [
        {
          labelId: null,
          name: draft.labelName,
          catalogNumber: draft.catalogNumber ?? null,
          hasNoCatalogNumber: !draft.catalogNumber?.trim(),
        },
      ]
    : []
}

export function withDraftArtistCredits(
  draft: ReleaseImportDraft,
  credits: ReleaseImportArtistCredit[],
): ReleaseImportDraft {
  const normalizedCredits = credits
    .map((credit) => ({
      artistId: credit.artistId ?? null,
      name: credit.name.trim(),
      role: credit.role.trim(),
    }))
    .filter((credit) => credit.artistId || credit.name)

  return {
    ...draft,
    artistCredits: normalizedCredits,
    artistNames: normalizedCredits.map((credit) => credit.name),
    selectedArtistIds: normalizedCredits
      .map((credit) => credit.artistId)
      .filter((artistId): artistId is string => Boolean(artistId)),
  }
}

export function withDraftLabels(
  draft: ReleaseImportDraft,
  labels: ReleaseImportLabel[],
): ReleaseImportDraft {
  const normalizedLabels = labels
    .map((label) => ({
      labelId: label.labelId ?? null,
      name: label.name.trim(),
      catalogNumber: label.hasNoCatalogNumber
        ? null
        : label.catalogNumber?.trim() || null,
      hasNoCatalogNumber: label.hasNoCatalogNumber,
    }))
    .filter((label) => label.labelId || label.name)
  const firstLabel = normalizedLabels[0]

  return {
    ...draft,
    labels: normalizedLabels,
    labelName: firstLabel?.name ?? null,
    catalogNumber: firstLabel?.catalogNumber ?? null,
  }
}

export function effectiveTrackArtistCredits(track: ReleaseImportDraftTrack) {
  if (track.artistCredits && track.artistCredits.length > 0) {
    return track.artistCredits
  }

  return track.artistNames.map(
    (name, index): ReleaseImportArtistCredit => ({
      artistId: track.selectedArtistIds[index] ?? null,
      name,
      role: 'mainArtist',
    }),
  )
}

export function withTrackArtistCredits(
  track: ReleaseImportDraftTrack,
  credits: ReleaseImportArtistCredit[],
): ReleaseImportDraftTrack {
  const normalizedCredits = credits
    .map((credit) => ({
      artistId: credit.artistId ?? null,
      name: credit.name.trim(),
      role: credit.role.trim(),
    }))
    .filter((credit) => credit.artistId || credit.name)

  return {
    ...track,
    artistCredits: normalizedCredits,
    inheritReleaseArtistCredits: track.inheritReleaseArtistCredits,
    artistNames: normalizedCredits.map((credit) => credit.name),
    selectedArtistIds: normalizedCredits
      .map((credit) => credit.artistId)
      .filter((artistId): artistId is string => Boolean(artistId)),
  }
}

export function importArtistCreditName(
  credit: ReleaseImportArtistCredit,
  artists: ArtistRecord[],
) {
  if (!credit.artistId) {
    return credit.name.trim()
  }

  return (
    artists.find((artist) => artist.id === credit.artistId)?.name.trim() ??
    credit.name.trim()
  )
}

export function dictionaryNameForCode(
  code: string,
  options: DictionaryEntry[],
) {
  return (
    options.find((option) => option.code === code || option.name === code)
      ?.name ?? code
  )
}

export function activeDictionaryOptions(
  dictionaries: CatalogDictionaries,
  kind: 'creditRole' | 'genre' | 'releaseType',
) {
  const activeOptions = dictionaries[kind].filter((entry) => entry.isActive)

  return activeOptions.length > 0
    ? activeOptions
    : defaultCatalogDictionaries[kind].filter((entry) => entry.isActive)
}

export function activeReleaseTypeOptions(dictionaries: CatalogDictionaries) {
  return activeDictionaryOptions(dictionaries, 'releaseType')
}

export function releaseTypeCodeForValue(
  value: string,
  releaseTypeOptions: DictionaryEntry[],
) {
  const normalized = value.trim()
  const matchingOption = releaseTypeOptions.find(
    (option) => option.code === normalized || option.name === normalized,
  )

  return matchingOption?.code ?? normalized
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Request failed.'
}

export function skipServerImportRequests() {
  return (
    import.meta.env.MODE === 'test' &&
    !('__discweaveUseRealCatalogApi' in globalThis)
  )
}

export function isDiscWeaveDesktop() {
  return window.discweaveDesktop?.isDesktop === true
}
