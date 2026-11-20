// Dragon Bridge desktop: the small, fixed set of things the game page may ask of the app.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('DBDesk', {
  platform: process.platform,
  info: () => ipcRenderer.invoke('app:info'),                // {deck, fullscreen, platform, version}
  quit: () => ipcRenderer.invoke('app:quit'),                // the title screen's Exit button
  canUpdate: () => ipcRenderer.invoke('upd:can'),            // in-app updates
  update: url => ipcRenderer.invoke('upd:go', url),
  onProgress: cb => { ipcRenderer.removeAllListeners('upd:progress'); ipcRenderer.on('upd:progress', (_e, pct) => cb(pct)); },
});
