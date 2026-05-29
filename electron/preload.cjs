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
})
