// Preload runs in an isolated context. Expose safe APIs here if needed.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('env', {
  mode: process.env.NODE_ENV || (process.env.ELECTRON_START_URL ? 'development' : 'production'),
})

// Database API
contextBridge.exposeInMainWorld('electronAPI', {
  dbQuery: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
  dbGet: (sql, params) => ipcRenderer.invoke('db:get', sql, params),
  dbRun: (sql, params) => ipcRenderer.invoke('db:run', sql, params),
  dbTransaction: (operations) => ipcRenderer.invoke('db:transaction', operations),
  getNextSequence: (sequenceName) => ipcRenderer.invoke('db:getNextSequence', sequenceName),
  authenticateUser: (username, password) => ipcRenderer.invoke('auth:login', username, password),
})
