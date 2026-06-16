import { createServer, IncomingMessage, ServerResponse } from 'http'
import crypto from 'crypto'
import log from 'electron-log/main'
import { API_PORT } from '@shared/constants'
import type { PushStatus } from '@shared/types'

/**
 * PetAPIServer — 内嵌 HTTP 服务器
 * 监听 localhost，接收外部工具推送的状态更新
 */
export class PetAPIServer {
  private server: ReturnType<typeof createServer> | null = null
  private port = API_PORT
  private token: string
  private onStatus?: (data: PushStatus) => void

  constructor(existingToken?: string) {
    this.token = existingToken || crypto.randomBytes(16).toString('hex')
  }

  getToken(): string {
    return this.token
  }

  start(onStatus: (data: PushStatus) => void): void {
    this.onStatus = onStatus

    this.server = createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json')

      // Health check（无需 token）
      if (req.method === 'GET' && req.url === '/api/health') {
        res.writeHead(200)
        res.end(JSON.stringify({ ok: true, version: '1.0.0' }))
        return
      }

      // 其他接口校验 token
      const reqToken = req.headers['x-pet-token'] as string
      if (reqToken !== this.token) {
        res.writeHead(401)
        res.end(JSON.stringify({ error: 'Invalid token' }))
        log.warn('API: unauthorized request attempt')
        return
      }

      if (req.method === 'POST' && req.url === '/api/status') {
        this.handleStatus(req, res)
      } else {
        res.writeHead(404)
        res.end(JSON.stringify({ error: 'Not Found' }))
      }
    })

    this.server.listen(this.port, '127.0.0.1', () => {
      log.info(`DesktopXPet API listening on http://127.0.0.1:${this.port}`)
    })

    this.server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        log.warn(`Port ${this.port} is in use, trying ${this.port + 1}`)
        this.port++
        this.server!.listen(this.port, '127.0.0.1')
      } else {
        log.error('API server error:', err)
      }
    })
  }

  private handleStatus(req: IncomingMessage, res: ServerResponse): void {
    const MAX_BODY_SIZE = 10 * 1024 // 10KB 限制
    let body = ''
    let oversized = false

    req.on('data', (chunk) => {
      if (body.length + chunk.length > MAX_BODY_SIZE) {
        oversized = true
        res.writeHead(413)
        res.end(JSON.stringify({ error: 'Request body too large' }))
        req.destroy()
        return
      }
      body += chunk
    })

    req.on('end', () => {
      if (oversized) return
      try {
        const data: PushStatus = JSON.parse(body)
        this.onStatus?.(data)
        res.writeHead(200)
        res.end(JSON.stringify({ ok: true }))
        log.info(`Push received: ${data.tool} = ${data.status}`)
      } catch {
        res.writeHead(400)
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
      }
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          log.info('API server stopped')
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  getPort(): number {
    return this.port
  }
}
