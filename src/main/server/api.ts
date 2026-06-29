import { createServer, IncomingMessage, ServerResponse } from 'http'
import crypto from 'crypto'
import { createLogger } from '../utils/logger'
const log = createLogger('PetAPIServer')
import { API_PORT } from '@shared/constants'
import type { PushStatus } from '@shared/types'

/** details 字段允许的原始值类型 */
type PrimitiveValue = string | number | boolean | null

/**
 * 清洗 details 字段:只允许扁平的 plain object,且值只能是原始类型。
 * 防止下游代码收到数组、嵌套对象、函数等异常数据。
 * 限制键数量 ≤ 50,防止超大对象。
 */
function sanitizeDetails(details: unknown): Record<string, PrimitiveValue> | undefined {
  if (details == null) return undefined
  if (typeof details !== 'object' || Array.isArray(details)) return undefined
  const obj = details as Record<string, unknown>
  const result: Record<string, PrimitiveValue> = {}
  let count = 0
  for (const key of Object.keys(obj)) {
    if (count >= 50) break
    const v = obj[key]
    if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      result[key] = v
      count++
    }
  }
  return result
}

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

  start(onStatus: (data: PushStatus) => void): Promise<number> {
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

    // 返回 Promise,在 listening 事件触发后 resolve(返回实际端口)
    // 修复:start() 原为同步方法,端口冲突时 error 事件异步触发,
    // 调用方在 start() 返回后立即 getPort() 会拿到旧的默认端口,
    // 导致 CLI config 和日志写入错误端口,IDE 扩展连接失败。
    return new Promise<number>((resolve, reject) => {
      let resolved = false
      const onListening = () => {
        if (resolved) return
        resolved = true
        log.info(`DesktopXPet API listening on http://127.0.0.1:${this.port}`)
        resolve(this.port)
      }
      const onError = (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          if (this.port >= API_PORT + 10) {
            if (!resolved) {
              resolved = true
              log.error(`Port ${API_PORT}-${this.port} all in use, giving up`)
              reject(new Error(`All ports ${API_PORT}-${this.port} in use`))
            }
            return
          }
          log.warn(`Port ${this.port} is in use, trying ${this.port + 1}`)
          this.port++
          this.server!.listen(this.port, '127.0.0.1')
        } else {
          if (!resolved) {
            resolved = true
            log.error('API server error:', err)
            reject(err)
          }
        }
      }

      this.server!.once('listening', onListening)
      this.server!.on('error', onError)
      this.server!.listen(this.port, '127.0.0.1')
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
          details: sanitizeDetails(data.details),
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
      if (!this.server) {
        resolve()
        return
      }
      const server = this.server
      this.server = null
      let done = false
      const finish = () => {
        if (done) return
        done = true
        log.info('API server stopped')
        resolve()
      }
      // server.close 在有活跃连接时回调不触发，加 2s 超时兜底
      server.close(() => finish())
      setTimeout(finish, 2000)
    })
  }

  getPort(): number {
    return this.port
  }
}
