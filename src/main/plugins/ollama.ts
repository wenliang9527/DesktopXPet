import { createLogger } from '../utils/logger'
const log = createLogger('Ollama')
import type { MonitorPlugin, MonitorStatus } from '@shared/types'

// Ollama API 响应类型定义
interface OllamaModel {
  name: string
  size?: number
  details?: { parameter_size?: string; quantization_level?: string }
}
interface OllamaTagsResponse {
  models: OllamaModel[]
}
interface OllamaModelInfo {
  name: string
  state: string
  size?: number
  size_vram?: number
}
interface OllamaPsResponse {
  models: OllamaModelInfo[]
}

/**
 * Ollama 本地 AI 服务监控插件
 * 数据来源：Ollama 本地 REST API (localhost:11434)
 */
export class OllamaPlugin implements MonitorPlugin {
  name = 'ollama'
  icon = '🤖'
  pollInterval = 15_000 // 15秒

  // 连续失败计数与日志去重
  private consecutiveFailures = 0
  private hasLoggedFailure = false

  async fetchStatus(): Promise<MonitorStatus> {
    // 并行请求 /api/tags 和 /api/ps，各自 try/catch
    const [modelsResult, psResult] = await Promise.all([
      (async () => {
        try {
          const resp = await fetch('http://localhost:11434/api/tags', {
            signal: AbortSignal.timeout(5000),
          })
          if (!resp.ok) return { ok: false as const }
          const data = (await resp.json()) as OllamaTagsResponse
          return { ok: true as const, models: data.models || [] }
        } catch {
          return { ok: false as const }
        }
      })(),
      (async () => {
        try {
          const resp = await fetch('http://localhost:11434/api/ps', {
            signal: AbortSignal.timeout(5000),
          })
          if (!resp.ok) return { ok: false as const }
          const data = (await resp.json()) as OllamaPsResponse
          return { ok: true as const, models: data.models || [] }
        } catch {
          return { ok: false as const }
        }
      })(),
    ])

    // 两个请求都失败，说明 Ollama 不可达
    // 注意：服务未运行属于"工具未启用"而非"应用出错"，返回 idle 而非 error，
    // 避免 petState 被聚合为 error 导致宠物持续显示错误状态并触发重复通知。
    if (!modelsResult.ok && !psResult.ok) {
      this.consecutiveFailures++
      // 仅首次失败时打印日志，避免持续刷屏
      if (!this.hasLoggedFailure) {
        log.warn('Ollama 服务未运行，后续失败将静默（服务恢复后自动恢复正常）')
        this.hasLoggedFailure = true
      }
      return {
        tool: 'Ollama',
        status: 'idle',
        summary: 'Ollama 未运行',
        timestamp: Date.now(),
      }
    }

    // 成功：重置失败状态
    if (this.consecutiveFailures > 0) {
      log.info('Ollama 服务已恢复')
      this.consecutiveFailures = 0
      this.hasLoggedFailure = false
    }

    // /api/tags 失败但 /api/ps 成功，视为部分可用
    if (!modelsResult.ok) {
      const runningModels = psResult.ok ? psResult.models : []
      return {
        tool: 'Ollama',
        status: runningModels.length > 0 ? 'working' : 'error',
        summary: runningModels.length > 0
          ? `运行中: ${runningModels.map((m: OllamaModelInfo) => m.name).join(', ')}`
          : 'Ollama 服务响应异常',
        details: {
          runningModels: runningModels.map((m: OllamaModelInfo) => ({
            name: m.name,
            size: m.size,
          })),
        },
        timestamp: Date.now(),
      }
    }

    const models = modelsResult.models
    const runningModels = psResult.ok ? psResult.models : []

    return {
      tool: 'Ollama',
      status: runningModels.length > 0 ? 'working' : 'idle',
      summary:
        runningModels.length > 0
          ? `运行中: ${runningModels.map((m: OllamaModelInfo) => m.name).join(', ')}`
          : `${models.length} 个模型就绪`,
      details: {
        availableModels: models.map((m: OllamaModel) => m.name),
        runningModels: runningModels.map((m: OllamaModelInfo) => ({
          name: m.name,
          size: m.size,
        })),
      },
      timestamp: Date.now(),
    }
  }

  async dispose(): Promise<void> {
    // 无需清理
  }
}
