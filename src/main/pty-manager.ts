import { getMainWindow } from './index'

// node-pty is loaded dynamically since it's a native module
let pty: any
try {
  pty = require('node-pty')
} catch {
  console.warn('node-pty not available, terminal features disabled')
}

interface PtyInstance {
  process: any
  id: string
}

const ptys = new Map<string, PtyInstance>()

export function createPty(
  id: string,
  cwd: string,
  shell?: string
): string {
  if (!pty) throw new Error('node-pty not available')

  const shellPath = shell || (process.platform === 'win32'
    ? process.env.COMSPEC || 'powershell.exe'
    : process.env.SHELL || '/bin/bash')

  const proc = pty.spawn(shellPath, [], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd,
    env: { ...process.env }
  })

  ptys.set(id, { process: proc, id })

  // Forward data to renderer
  proc.onData((data: string) => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('terminal:data', id, data)
    }
  })

  proc.onExit(({ exitCode }: { exitCode: number }) => {
    console.log(`PTY ${id} exited with code ${exitCode}`)
    ptys.delete(id)
  })

  return id
}

export function writeToPty(id: string, data: string): void {
  const instance = ptys.get(id)
  if (instance) instance.process.write(data)
}

export function killPty(id: string): void {
  const instance = ptys.get(id)
  if (instance) {
    instance.process.kill()
    ptys.delete(id)
  }
}

export function resizePty(id: string, cols: number, rows: number): void {
  const instance = ptys.get(id)
  if (instance) instance.process.resize(cols, rows)
}

export function getPty(id: string): any | null {
  const instance = ptys.get(id)
  return instance?.process || null
}

export function getAllPtyIds(): string[] {
  return Array.from(ptys.keys())
}
