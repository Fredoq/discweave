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
    watch: {
      list: () => ipcRenderer.invoke('discweave:imports:watch:list'),
      add: (request) =>
        ipcRenderer.invoke('discweave:imports:watch:add', request),
      remove: (sourceRoot) =>
        ipcRenderer.invoke('discweave:imports:watch:remove', sourceRoot),
      update: (sourceRoot, patch) =>
        ipcRenderer.invoke('discweave:imports:watch:update', sourceRoot, patch),
      snapshot: (sourceRoot) =>
        ipcRenderer.invoke('discweave:imports:watch:snapshot', sourceRoot),
      scanFiles: (sourceRoot, filePaths) =>
        ipcRenderer.invoke(
          'discweave:imports:watch:scan-files',
          sourceRoot,
          filePaths,
        ),
      onChanged: (listener) => {
        const handler = (_event, sourceRoot) => listener(sourceRoot)
        ipcRenderer.on('discweave:imports:watch:changed', handler)
        return () =>
          ipcRenderer.removeListener('discweave:imports:watch:changed', handler)
      },
    },
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
