import type {
  KnownLocalEditTags,
  LocalEditableFile,
  LocalEditTags,
} from './localFileEditModel'

export type LocalEditInspectResult = {
  path: string
  format: string
  sizeBytes: number
  lastModifiedAt: string
  tags: LocalEditTags
  technical: {
    bitDepth: number | null
    durationSeconds: number | null
    sampleRate: number | null
  }
}

export type LocalEditIssue = {
  code: string
  message: string
  severity: 'error' | 'warning'
}

export type LocalEditPreviewChange = {
  ownedItemId: string
  currentPath: string
  targetPath: string
  format: string
  rename: boolean
  tagWritable: boolean
  tagChanges: LocalEditTags
  issues: LocalEditIssue[]
}

export type LocalEditPreviewResult = {
  ok: boolean
  changes: LocalEditPreviewChange[]
}

export type LocalFilePreviewRow = LocalEditPreviewChange & {
  title: string
  position: string
}

export type LocalEditMode = 'fileNames' | 'tags'

export type InspectState =
  | { status: 'loading' }
  | { status: 'loaded'; result: LocalEditInspectResult }
  | { status: 'failed'; message: string }

export type LocalEditableFileDraft = LocalEditableFile & {
  targetPath: string
  targetTags: LocalEditTags
}

export type LocalValidationIssue = LocalEditIssue & {
  ownedItemId: string
  title: string
}

export const writableTagFormats = new Set(['flac', 'mp3', 'm4a', 'ogg'])

export const scalarTagFields = [
  'title',
  'album',
  'date',
  'label',
  'catalogNumber',
] as const

export const numericTagFields = ['trackNumber', 'year'] as const

export const listTagFields = [
  'artists',
  'albumArtists',
  'genre',
  'composer',
  'producer',
  'remixer',
] as const

export const tagFieldLabels: Record<keyof KnownLocalEditTags, string> = {
  title: 'Title',
  artists: 'Artists',
  album: 'Album',
  albumArtists: 'Album artists',
  trackNumber: 'Track number',
  date: 'Date',
  year: 'Year',
  genre: 'Genre',
  label: 'Label',
  catalogNumber: 'Catalog number',
  composer: 'Composer',
  producer: 'Producer',
  remixer: 'Remixer',
}

export function tagFieldLabel(field: string) {
  return tagFieldLabels[field as keyof KnownLocalEditTags] ?? field
}
