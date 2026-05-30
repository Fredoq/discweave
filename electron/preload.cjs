const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('cratebaseDesktop', {
  isDesktop: true,
  exports: {
    download: (format) =>
      ipcRenderer.invoke('cratebase:exports:download', format),
  },
  imports: {
    pickAndScan: (options) =>
      ipcRenderer.invoke('cratebase:imports:pick-and-scan', options),
  },
  localEdits: {
    inspect: (request) =>
      ipcRenderer.invoke('cratebase:local-edits:inspect', request),
    preview: (request) =>
      ipcRenderer.invoke('cratebase:local-edits:preview', request),
    apply: (request) =>
      ipcRenderer.invoke('cratebase:local-edits:apply', request),
  },
})
