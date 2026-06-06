'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Secure bridge: the renderer never touches Node directly. Everything that
// needs the filesystem, dialogs, docx conversion, or window control goes
// through this typed surface.
contextBridge.exposeInMainWorld('wordAPI', {
  // Window controls (custom title bar)
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onStateChange: (cb) => ipcRenderer.on('window:state', (_e, s) => cb(s)),
  },

  // Documents
  open: (presetPath) => ipcRenderer.invoke('doc:open', presetPath),
  save: (payload) => ipcRenderer.invoke('doc:save', payload),
  saveAs: (payload) => ipcRenderer.invoke('doc:saveAs', payload),
  exportPdf: (payload) => ipcRenderer.invoke('doc:exportPdf', payload),
  print: () => ipcRenderer.invoke('doc:print'),

  // Phase 2 bytes channels (PM core: renderer-side .docx converter)
  saveBytes: (payload) => ipcRenderer.invoke('doc:saveBytes', payload),
  saveAsBytes: (payload) => ipcRenderer.invoke('doc:saveAsBytes', payload),
  openBytes: (presetPath) => ipcRenderer.invoke('doc:openBytes', presetPath),

  // Recent files
  recent: {
    list: () => ipcRenderer.invoke('recent:list'),
    clear: () => ipcRenderer.invoke('recent:clear'),
  },

  // Inserts
  pickImage: () => ipcRenderer.invoke('fs:readImage'),
  screenshot: () => ipcRenderer.invoke('insert:screenshot'),

  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // Menu accelerators forwarded from main
  onMenuAction: (cb) => ipcRenderer.on('menu:action', (_e, action) => cb(action)),
});
