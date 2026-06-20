import type { MonitorPlugin, MonitorStatus } from '@shared/types'

/**
 * Ollama 本地 AI 服务监控插件
 * 数据来源：Ollama 本地 REST API (localhost:11434)
 */
export class OllamaPlugin implements MonitorPlugin {
  name = 'ollama'
  icon = '🤖'
  pollInterval = 15_000 // 15秒

  async fetchStatus(): Promise<MonitorStatus> {
    try {
      // 检查 Ollama 是否在运行
      const modelsResp = await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(5000),
      })

      if (!modelsResp.ok) {
        return {
          tool: 'Ollama',
          status: 'error',
          summary: 'Ollama 服务响应异常',
          timestamp: Date.now(),
        }
      }

      const modelsData = (await modelsResp.json()) as any
      const models = modelsData.models || []

      // 检查是否有正在运行的推理
      const psResp = await fetch('http://localhost:11434/api/ps', {
        signal: AbortSignal.timeout(5000),
      })

      let runningModels: any[] = []
      if (psResp.ok) {
        const psData = (await psResp.json()) as any
        runningModels = psData.models || []
      }

      return {
        tool: 'Ollama',
        status: runningModels.length > 0 ? 'working' : 'idle',
        summary:
          runningModels.length > 0
            ? `运行中: ${runningModels.map((m: any) => m.name).join(', ')}`
            : `${models.length} 个模型就绪`,
        details: {
          availableModels: models.map((m: any) => m.name),
          runningModels: runningModels.map((m: any) => ({
            name: m.name,
            size: m.size,
          })),
        },
        timestamp: Date.now(),
      }
    } catch {
      return {
        tool: 'Ollama',
        status: 'idle',
        summary: 'Ollama 服务未运行',
        timestamp: Date.now(),
      }
    }
  }

  async dispose(): Promise<void> {
    // 无需清理
  }
}
