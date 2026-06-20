import { createServer, IncomingMessage, ServerResponse } from 'http'
import crypto from 'crypto'
import { createLogger } from '../utils/logger'
const log = createLogger('PetAPIServer')
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

    this.server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        // 端口冲突重试上限保护
        if (this.port >= API_PORT + 10) {
          log.error(`Port ${API_PORT}-${this.port} all in use, giving up`)
          return
        }
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
        const data = JSON.parse(body)
        // 输入验证：确保必要字段存在且类型正确
        if (typeof data.tool !== 'string' || typeof data.status !== 'string') {
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'Missing required fields: tool, status' }))
          return
        }
        const validStatuses = ['idle', 'working', 'completed', 'error']
        if (!validStatuses.includes(data.status)) {
          res.writeHead(400)
          res.end(
            JSON.stringify({ error: `Invalid status, must be one of: ${validStatuses.join(', ')}` })
          )
          return
        }
        const validated: PushStatus = {
          tool: String(data.tool).slice(0, 100),
          status: data.status,
          summary: data.summary ? String(data.summary).slice(0, 500) : '',
          details: data.details,
        }
        this.onStatus?.(validated)
        res.writeHead(200)
        res.end(JSON.stringify({ ok: true }))
        log.info(`Push received: ${validated.tool} = ${validated.status}`)
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
