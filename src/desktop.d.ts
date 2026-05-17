import type { DesktopFolderScanRequest } from './features/catalog/catalogApi'

declare global {
  interface Window {
    cratebaseDesktop?: {
      isDesktop: true
      imports: {
        pickAndScan: () => Promise<
          | { cancelled: true }
          | { cancelled: false; scan: DesktopFolderScanRequest }
        >
      }
    }
  }
}

export {}
