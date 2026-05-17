const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('cratebaseDesktop', {
  isDesktop: true,
  imports: {
    pickAndScan: () => ipcRenderer.invoke('cratebase:imports:pick-and-scan'),
  },
})
