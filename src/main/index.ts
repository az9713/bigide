import { app, BrowserWindow, shell, session } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc-handlers'
import { getTasks, setTasks } from './store'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'BigIDE',
    backgroundColor: '#0f0f13',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true
    }
  })

  mainWindow.setMenuBarVisibility(false)

  // Allow webview to load localhost for preview server
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: ['http://127.0.0.1:*/*'] },
    (details, callback) => {
      callback({ cancel: false, requestHeaders: details.requestHeaders })
    }
  )

  // Handle webview permission requests
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(true)
  })

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // DevTools: press Ctrl+Shift+I to open manually when needed
  // if (process.env.ELECTRON_RENDERER_URL) {
  //   mainWindow.webContents.openDevTools({ mode: 'bottom' })
  // }

  // Load renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Reset stale tasks from previous session — tasks stuck in "running"
  // no longer have a live PTY, so mark them as "error" with an explanation
  const tasks = getTasks()
  let changed = false
  for (const task of tasks) {
    if (task.status === 'running') {
      task.status = 'error'
      task.lastOutputLine = 'Task was interrupted by app restart'
      task.ptyId = null
      task.needsInput = false
      changed = true
    }
  }
  if (changed) setTasks(tasks)

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
