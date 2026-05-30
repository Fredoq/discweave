const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('discweaveDesktop', {
  isDesktop: true,
  exports: {
    download: (format) =>
      ipcRenderer.invoke('discweave:exports:download', format),
  },
  imports: {
    pickAndScan: (options) =>
      ipcRenderer.invoke('discweave:imports:pick-and-scan', options),
  },
  localEdits: {
    inspect: (request) =>
      ipcRenderer.invoke('discweave:local-edits:inspect', request),
    preview: (request) =>
      ipcRenderer.invoke('discweave:local-edits:preview', request),
    apply: (request) =>
      ipcRenderer.invoke('discweave:local-edits:apply', request),
  },
})
