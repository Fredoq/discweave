import type {
  DesktopFolderScanRequest,
  DesktopImportScanMode,
} from './features/catalog/catalogApi'

type DesktopExportFormat = 'csv' | 'json'

type DesktopExportDownloadResult =
  | { cancelled: true }
  | { cancelled: false; path: string }

declare global {
  interface Window {
    cratebaseDesktop?: {
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
      }
    }
  }
}

export {}
