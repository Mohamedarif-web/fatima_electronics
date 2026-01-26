const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const database = require('./database/db')

// Determine if we're in development or production
const isDev = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_START_URL

// For production builds, files are in the app.asar package
let RENDERER_DIST
if (isDev) {
  // Development: files are in the project directory
  process.env.APP_ROOT = path.join(__dirname, '../..')
  RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
} else {
  // Production: files are packaged with the app
  RENDERER_DIST = path.join(__dirname, '../dist')
}

const VITE_DEV_SERVER_URL = isDev

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(__dirname, '../../public')
  : RENDERER_DIST

let mainWindow

async function createWindow() {
  // Initialize database first
  try {
    console.log('🔧 Initializing database...')
    await database.initialize()
    console.log('✅ Database initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize database:', error)
    // Continue anyway - app might still work
  }

  console.log('🚀 Creating main window...')

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    titleBarOverlay: process.platform === 'darwin' ? { color: '#16a34a', symbolColor: '#ffffff', height: 36 } : undefined,
    trafficLightPosition: process.platform === 'darwin' ? { x: 12, y: 12 } : undefined,
    backgroundColor: '#ffffff',
    frame: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      experimentalFeatures: true
    },
    show: false
  })

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Test active push message to Renderer-process.
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    // Load with cache disabled for production
    mainWindow.webContents.session.clearCache()
    const indexPath = path.join(RENDERER_DIST, 'index.html')
    console.log('Loading index.html from:', indexPath)
    console.log('RENDERER_DIST:', RENDERER_DIST)
    mainWindow.loadFile(indexPath)
  }
}

// Database IPC handlers
ipcMain.handle('db:query', async (event, sql, params) => {
  try {
    return await database.all(sql, params)
  } catch (error) {
    console.error('Database query error:', error)
    throw error
  }
})

ipcMain.handle('db:get', async (event, sql, params) => {
  try {
    return await database.get(sql, params)
  } catch (error) {
    console.error('Database get error:', error)
    throw error
  }
})

ipcMain.handle('db:run', async (event, sql, params) => {
  try {
    return await database.run(sql, params)
  } catch (error) {
    console.error('Database run error:', error)
    throw error
  }
})

ipcMain.handle('db:transaction', async (event, operations) => {
  try {
    return await database.transaction(async () => {
      const results = []
      for (const op of operations) {
        const result = await database.run(op.sql, op.params)
        results.push(result)
      }
      return results
    })
  } catch (error) {
    console.error('Database transaction error:', error)
    throw error
  }
})

ipcMain.handle('db:getNextSequence', async (event, sequenceName) => {
  try {
    return await database.getNextSequence(sequenceName)
  } catch (error) {
    console.error('Get sequence error:', error)
    throw error
  }
})

// Authentication removed - direct access to main screen

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', async () => {
  await database.close()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', async () => {
  await database.close()
})

// Add error handling for app startup
app.whenReady().then(() => {
  console.log('🎯 Electron app is ready')
  createWindow().catch(error => {
    console.error('❌ Failed to create window:', error)
  })
}).catch(error => {
  console.error('❌ Failed to start Electron app:', error)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
})