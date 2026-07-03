const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('discweaveDesktop', {
  isDesktop: true,
  backend: {
    status: () => ipcRenderer.invoke('discweave:backend:status'),
  },
  exports: {
    download: (format) =>
      ipcRenderer.invoke('discweave:exports:download', format),
  },
  imports: {
    pickAndScan: (options) =>
      ipcRenderer.invoke('discweave:imports:pick-and-scan', options),
    rescanSource: (sourceRoot, options) =>
      ipcRenderer.invoke(
        'discweave:imports:rescan-source',
        sourceRoot,
        options,
      ),
  },
  localEdits: {
    inspect: (request) =>
      ipcRenderer.invoke('discweave:local-edits:inspect', request),
    preview: (request) =>
      ipcRenderer.invoke('discweave:local-edits:preview', request),
    apply: (request) =>
      ipcRenderer.invoke('discweave:local-edits:apply', request),
  },
  localFiles: {
    open: (request) =>
      ipcRenderer.invoke('discweave:local-files:open', request),
  },
})
