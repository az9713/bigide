import { createServer, type Server } from 'http'
import { readFile } from 'fs/promises'
import { join, extname } from 'path'
import { existsSync } from 'fs'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
}

let activeServer: Server | null = null
let activePort = 0
let servingPath = ''

export async function startFileServer(rootPath: string): Promise<number> {
  // If already serving this path, return existing port
  if (activeServer && servingPath === rootPath) return activePort

  // Stop previous server
  await stopFileServer()

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        // CORS headers for local preview
        res.setHeader('Access-Control-Allow-Origin', '*')

        let urlPath = decodeURIComponent(req.url || '/')
        if (urlPath === '/') urlPath = '/index.html'

        const filePath = join(rootPath, urlPath)

        // Security: prevent path traversal
        if (!filePath.startsWith(rootPath)) {
          res.writeHead(403)
          res.end('Forbidden')
          return
        }

        if (!existsSync(filePath)) {
          // Try index.html fallback for SPA
          const indexPath = join(rootPath, 'index.html')
          if (existsSync(indexPath)) {
            const content = await readFile(indexPath)
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(content)
            return
          }
          res.writeHead(404)
          res.end('Not found')
          return
        }

        const ext = extname(filePath).toLowerCase()
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream'
        const content = await readFile(filePath)
        res.writeHead(200, { 'Content-Type': mimeType })
        res.end(content)
      } catch (err) {
        res.writeHead(500)
        res.end('Internal server error')
      }
    })

    // Find a free port
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr !== 'string') {
        activePort = addr.port
        activeServer = server
        servingPath = rootPath
        resolve(activePort)
      } else {
        reject(new Error('Failed to get server address'))
      }
    })

    server.on('error', reject)
  })
}

export async function stopFileServer(): Promise<void> {
  if (activeServer) {
    return new Promise((resolve) => {
      activeServer!.close(() => {
        activeServer = null
        activePort = 0
        servingPath = ''
        resolve()
      })
    })
  }
}

export function getFileServerUrl(): string | null {
  if (activeServer && activePort) {
    return `http://127.0.0.1:${activePort}`
  }
  return null
}
