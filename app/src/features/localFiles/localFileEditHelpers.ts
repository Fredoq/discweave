import type { LocalEditTags } from './localFileEditModel'
import type {
  InspectState,
  LocalEditableFileDraft,
  LocalEditInspectResult,
  LocalEditMode,
  LocalEditPreviewResult,
  LocalFilePreviewRow,
} from './localFileEditTypes'
import {
  listTagFields,
  numericTagFields,
  scalarTagFields,
  writableTagFormats,
} from './localFileEditTypes'
import type { LocalEditableFile } from './localFileEditModel'
import type { NamingProfile } from '../catalog/catalogApi'

export function toDraft(file: LocalEditableFile): LocalEditableFileDraft {
  return {
    ...file,
    targetPath: file.targetPath ?? file.currentPath,
    targetTags: normalizeTagDraft(file.tags),
  }
}

export function applyHelpText(mode: LocalEditMode) {
  return mode === 'fileNames'
    ? 'Paths are checked before writing. Tags are edited in the Tags mode.'
    : 'Tag support is checked before writing. Catalog metadata is not changed.'
}

export function isTagWritable(path: string) {
  return writableTagFormats.has(extensionWithoutDot(path).toLowerCase())
}

export function allTagFields(...tagSets: LocalEditTags[]): string[] {
  return uniqueTagFields([
    ...scalarTagFields,
    ...numericTagFields,
    ...listTagFields,
    ...tagSets.flatMap((tags) => Object.keys(tags)),
  ])
}

export function displayTagValue(value: LocalEditTags[string]) {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(' / ') : '-'
  }

  return value === null || value === undefined || value === '' ? '-' : value
}

export function embeddedTagValue(
  inspection: InspectState | undefined,
  field: string,
) {
  if (!inspection || inspection.status === 'loading') {
    return 'Inspecting...'
  }

  if (inspection.status === 'failed') {
    return 'Unavailable'
  }

  return displayTagValue(inspection.result.tags[field])
}

export function stringInputValue(value: string | null | undefined) {
  return value ?? ''
}

export function scalarTagValue(value: string) {
  return value.length > 0 ? value : null
}

export function numberInputValue(value: number | null | undefined) {
  return typeof value === 'number' ? String(value) : ''
}

export function numberTagValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export function tagChangesByDraftId(
  drafts: LocalEditableFileDraft[],
  inspections: Record<string, InspectState>,
) {
  return new Map(
    drafts.map((draft) => [
      draft.ownedItemId,
      tagChangesForDraft(draft, inspections[draft.ownedItemId]),
    ]),
  )
}

export function hasTagValues(tags: LocalEditTags) {
  return Object.keys(tags).length > 0
}

function tagChangesForDraft(
  draft: LocalEditableFileDraft,
  inspection?: InspectState,
) {
  if (!isTagWritable(draft.currentPath) || inspection?.status !== 'loaded') {
    return {}
  }

  return diffTags(inspection.result.tags, draft.targetTags)
}

function diffTags(currentTags: LocalEditTags, targetTags: LocalEditTags) {
  const changes: LocalEditTags = {}
  const writableChanges = changes as Record<string, unknown>

  for (const field of scalarTagFields) {
    const currentValue = normalizeScalarTag(currentTags[field])
    const targetValue = normalizeScalarTag(targetTags[field])
    if (currentValue !== targetValue) {
      writableChanges[field] = targetValue
    }
  }

  for (const field of numericTagFields) {
    const currentValue = normalizeNumberTag(currentTags[field])
    const targetValue = normalizeNumberTag(targetTags[field])
    if (currentValue !== targetValue) {
      writableChanges[field] = targetValue
    }
  }

  for (const field of listTagFields) {
    const currentValue = normalizeTagList(currentTags[field])
    const targetValue = normalizeTagList(targetTags[field])
    if (currentValue.join('\u0000') !== targetValue.join('\u0000')) {
      writableChanges[field] = targetValue
    }
  }

  for (const field of customTagFields(currentTags, targetTags)) {
    const currentValue = normalizeDynamicTag(currentTags[field])
    const targetValue = normalizeDynamicTag(targetTags[field])
    if (currentValue.join('\u0000') !== targetValue.join('\u0000')) {
      writableChanges[field] = targetValue
    }
  }

  return changes
}

export function normalizeTagDraft(tags: LocalEditTags) {
  const normalized: LocalEditTags = {}
  const writableNormalized = normalized as Record<string, unknown>

  for (const field of scalarTagFields) {
    writableNormalized[field] = normalizeScalarTag(tags[field])
  }

  for (const field of numericTagFields) {
    writableNormalized[field] = normalizeNumberTag(tags[field])
  }

  for (const field of listTagFields) {
    writableNormalized[field] = normalizeTagList(tags[field])
  }

  for (const field of customTagFields(tags)) {
    writableNormalized[field] = normalizeDynamicTag(tags[field])
  }

  return normalized
}

function normalizeScalarTag(value: LocalEditTags[string] | undefined) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeNumberTag(value: LocalEditTags[string] | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function normalizeTagList(value: LocalEditTags[string] | undefined) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((item) => item.trim()).filter(Boolean)
}

function normalizeDynamicTag(value: LocalEditTags[string] | undefined) {
  if (Array.isArray(value)) {
    return normalizeTagList(value)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? [trimmed] : []
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return [String(value)]
  }

  return []
}

function customTagFields(...tagSets: LocalEditTags[]) {
  const knownFields = new Set<string>([
    ...scalarTagFields,
    ...numericTagFields,
    ...listTagFields,
  ])

  return uniqueTagFields(
    tagSets
      .flatMap((tags) => Object.keys(tags))
      .filter((field) => !knownFields.has(field) && isSafeTagField(field)),
  )
}

function uniqueTagFields(fields: string[]) {
  return [...new Set(fields)]
}

function isSafeTagField(field: string) {
  return /^[A-Za-z0-9_.:-]{1,64}$/.test(field)
}

export function changeSummary(rows: LocalFilePreviewRow[]) {
  const renameCount = rows.filter((row) => row.rename).length
  const unchangedCount = rows.length - renameCount

  return `${renameCount} rename / ${unchangedCount} unchanged`
}

export function fileName(path: string) {
  return path.slice(path.lastIndexOf('/') + 1)
}

export function mergePreviewRows(
  drafts: LocalEditableFileDraft[],
  preview: LocalEditPreviewResult | null,
  tagChangesByOwnedItemId: Map<string, LocalEditTags>,
): LocalFilePreviewRow[] {
  const changesByOwnedItemId = new Map(
    preview?.changes.map((change) => [change.ownedItemId, change]) ?? [],
  )

  return drafts.map((draft) => {
    const change = changesByOwnedItemId.get(draft.ownedItemId)

    return {
      ownedItemId: draft.ownedItemId,
      title: draft.title,
      position: draft.position,
      currentPath: draft.currentPath,
      targetPath: draft.targetPath,
      format: extensionWithoutDot(draft.targetPath),
      rename:
        normalizePath(draft.currentPath) !== normalizePath(draft.targetPath),
      tagWritable:
        change?.tagWritable ??
        writableTagFormats.has(
          extensionWithoutDot(draft.targetPath).toLowerCase(),
        ),
      tagChanges:
        change?.tagChanges ??
        tagChangesByOwnedItemId.get(draft.ownedItemId) ??
        {},
      issues: change?.issues ?? [],
    }
  })
}

export function applyNamingProfile(
  drafts: LocalEditableFileDraft[],
  profile: NamingProfile,
  inspections: Record<string, InspectState>,
) {
  const releaseRoot = commonDirectory(
    drafts.map((draft) => directoryName(draft.currentPath)),
  )
  const releaseParent = directoryName(releaseRoot)

  return drafts.map((draft) => {
    const releaseFolder = renderTemplate(
      profile.releaseFolderTemplate,
      draft,
      'release',
      inspections[draft.ownedItemId],
    )
    const trackTemplate =
      splitList(draft.trackArtists).join(', ') ===
      splitList(draft.release.artists).join(', ')
        ? profile.trackFileTemplate
        : profile.trackFileWithArtistTemplate
    const trackFileName = `${renderTemplate(
      trackTemplate,
      draft,
      'track',
      inspections[draft.ownedItemId],
    )}.${extensionWithoutDot(draft.currentPath)}`
    const currentDirectory = directoryName(draft.currentPath)
    const relativeDirectory = relativePath(releaseRoot, currentDirectory)
    const targetDirectory = joinPath(
      releaseParent,
      releaseFolder,
      relativeDirectory,
    )

    return {
      ...draft,
      targetPath: joinPath(targetDirectory, trackFileName),
    }
  })
}

function renderTemplate(
  template: string,
  draft: LocalEditableFileDraft,
  kind: 'release' | 'track',
  inspection?: InspectState,
) {
  const technical =
    inspection?.status === 'loaded' ? inspection.result.technical : undefined
  const tokenValues: Record<string, string> = {
    releaseArtists: draft.release.artists,
    title: kind === 'release' ? draft.release.title : draft.title,
    releaseDate: draft.release.releaseDate ?? draft.release.year,
    year: draft.release.year,
    label: draft.release.label,
    catalogNumber: draft.release.catalogNumber ?? '',
    source: draft.release.source ?? '',
    format: extensionWithoutDot(draft.currentPath).toUpperCase(),
    bitDepth: technical?.bitDepth ? `${technical.bitDepth}-bit` : '',
    sampleRate: technical?.sampleRate
      ? `${technical.sampleRate / 1000} kHz`
      : '',
    position: draft.position,
    position2: paddedPosition(draft.position, 2),
    trackArtists: draft.trackArtists,
  }

  return sanitizePathSegment(
    template.replace(
      /\{([A-Za-z][A-Za-z0-9]*)\}/g,
      (_match, token: string) => tokenValues[token] ?? '',
    ),
  )
}

function paddedPosition(position: string, width: number) {
  const trimmed = position.trim()
  return /^\d+$/.test(trimmed) ? trimmed.padStart(width, '0') : trimmed
}

function sanitizePathSegment(value: string) {
  return value
    .replace(/[/:\\?*"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitList(value: string) {
  return value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
}

export function commonDirectory(paths: string[]) {
  if (paths.length === 0) {
    return ''
  }

  const parts = paths.map((path) => path.split('/').filter(Boolean))
  const commonParts: string[] = []
  for (let index = 0; index < parts[0].length; index += 1) {
    const part = parts[0][index]
    if (parts.every((candidate) => candidate[index] === part)) {
      commonParts.push(part)
    } else {
      break
    }
  }

  return `/${commonParts.join('/')}`
}

export function directoryName(path: string) {
  const index = path.lastIndexOf('/')

  return index > 0 ? path.slice(0, index) : ''
}

export function extensionWithoutDot(path: string) {
  const pathFileName = path.slice(path.lastIndexOf('/') + 1)
  const index = pathFileName.lastIndexOf('.')

  return index >= 0 ? pathFileName.slice(index + 1) : ''
}

export function relativePath(root: string, path: string) {
  const normalizedRoot = normalizePath(root)
  const normalizedPath = normalizePath(path)

  return normalizedPath.startsWith(`${normalizedRoot}/`)
    ? normalizedPath.slice(normalizedRoot.length + 1)
    : ''
}

export function joinPath(...parts: string[]) {
  const [firstPart, ...restParts] = parts.filter((part) => part.length > 0)
  if (!firstPart) {
    return ''
  }

  return [
    firstPart.replace(/\/+$/g, ''),
    ...restParts.map((part) => part.replace(/^\/+|\/+$/g, '')),
  ]
    .filter(Boolean)
    .join('/')
}

export function normalizePath(path: string) {
  return path.replace(/\/+/g, '/').replace(/\/$/g, '')
}

export function initialInspectionState(files: LocalEditableFile[]) {
  return Object.fromEntries(
    files.map((file) => [file.ownedItemId, { status: 'loading' }]),
  ) as Record<string, InspectState>
}

export function technicalSummary(
  technical: LocalEditInspectResult['technical'],
) {
  const sampleRate = technical.sampleRate
    ? `${technical.sampleRate / 1000} kHz`
    : 'sample rate unknown'
  const bitDepth = technical.bitDepth
    ? `${technical.bitDepth}-bit`
    : 'bit depth unknown'

  return `${sampleRate} / ${bitDepth}`
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
