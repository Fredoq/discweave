export type PlaylistExportEntry = {
  key: string
  trackId: string
  title: string
  artist: string
  duration: string
  file?: {
    path: string
    localAudioFileId: string
    digitalTrackFileLinkId: string
  }
}
export type PlaylistExportStatus =
  | 'available'
  | 'missing'
  | 'unlinked'
  | 'untrusted'
  | 'unsupported'
export type PlaylistExportInspection = {
  inspectionId: string
  entries: { key: string; status: PlaylistExportStatus; message?: string }[]
  availableCount: number
}
export type PlaylistExportResult =
  | { cancelled: true }
  | {
      cancelled: false
      blocked: true
      inspectionId: string
      entries: PlaylistExportInspection['entries']
      availableCount: number
    }
  | {
      cancelled: false
      blocked?: false
      path: string
      exportedCount: number
      omittedCount: number
    }
export type PlaylistExportBridge = {
  inspect: (request: {
    entries: PlaylistExportEntry[]
  }) => Promise<PlaylistExportInspection>
  export: (request: {
    name: string
    entries: PlaylistExportEntry[]
    allowPartial: boolean
    inspectionId: string
  }) => Promise<PlaylistExportResult>
}
