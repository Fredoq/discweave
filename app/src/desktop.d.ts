import type {
  DesktopFolderScanRequest,
  DesktopImportScanMode,
} from './features/catalog/catalogApi'

type DesktopExportFormat = 'csv' | 'json'

type DesktopExportDownloadResult =
  | { cancelled: true }
  | { cancelled: false; path: string }

type LocalEditTags = {
  title?: string | null
  artists?: string[]
  album?: string | null
  albumArtists?: string[]
  trackNumber?: number | null
  date?: string | null
  year?: number | null
  genre?: string[]
  label?: string | null
  catalogNumber?: string | null
  comment?: string | null
  composer?: string[]
  producer?: string[]
  remixer?: string[]
  [customTagField: string]: string | string[] | number | null | undefined
}

type LocalEditInspectRequest = {
  localAudioFileId: string
  path: string
}

type LocalEditInspectResult = {
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

type LocalEditFileRequest = {
  localAudioFileId: string
  currentPath: string
  targetPath: string
  tags?: LocalEditTags
}

type LocalEditPreviewRequest = {
  files: LocalEditFileRequest[]
}

type LocalEditIssue = {
  code: string
  message: string
  severity: 'error' | 'warning'
}

type LocalEditPreviewChange = {
  localAudioFileId: string
  currentPath: string
  targetPath: string
  format: string
  rename: boolean
  tagWritable: boolean
  tagChanges: LocalEditTags
  issues: LocalEditIssue[]
}

type LocalEditPreviewResult = {
  ok: boolean
  changes: LocalEditPreviewChange[]
}

type LocalEditApplyResult = {
  applied: boolean
  operationLogPath: string | null
  changes?: LocalEditPreviewChange[]
  failedFile?: {
    localAudioFileId: string
    currentPath?: string
    targetPath?: string
    error?: string
  } | null
  files: Array<{
    localAudioFileId: string
    path: string
    format: string
    sizeBytes: number
    lastModifiedAt: string
    contentHash: string
  }>
}

declare global {
  interface Window {
    discweaveDesktop?: {
      isDesktop: true
      exports: {
        download: (
          format: DesktopExportFormat,
        ) => Promise<DesktopExportDownloadResult>
      }
      imports: {
        pickAndScan: (options?: {
          mode?: DesktopImportScanMode
        }) => Promise<
          | { cancelled: true }
          | { cancelled: false; scan: DesktopFolderScanRequest }
        >
        rescanSource?: (
          sourceRoot: string,
          options?: { mode?: DesktopImportScanMode },
        ) => Promise<DesktopFolderScanRequest>
      }
      localEdits?: {
        inspect: (
          request: LocalEditInspectRequest,
        ) => Promise<LocalEditInspectResult>
        preview: (
          request: LocalEditPreviewRequest,
        ) => Promise<LocalEditPreviewResult>
        apply: (
          request: LocalEditPreviewRequest,
        ) => Promise<LocalEditApplyResult>
      }
    }
  }
}

export {}
