import log from 'electron-log/main'
import type { MonitorPlugin, MonitorStatus, AggregatedStatus, PushStatus } from '@shared/types'
import { PUSH_TTL_MS } from '@shared/constants'
import { PluginRegistry } from './registry'

/**
 * MonitorService — 监控调度器
 * 调度所有已启用插件的定时轮询、聚合状态、推送给渲染进程
 */
export class MonitorService {
  private registry: PluginRegistry
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map()
  private latestStatus: AggregatedStatus | null = null
  private pushCache: Map<string, { data: PushStatus; expiresAt: number }> = new Map()
  private lastFetchResults: Map<string, MonitorStatus> = new Map()
  private onUpdate?: (status: AggregatedStatus) => void

  constructor(registry: PluginRegistry, onUpdate?: (status: AggregatedStatus) => void) {
    this.registry = registry
    this.onUpdate = onUpdate
  }

  /**
   * 启动所有插件的定时轮询
   */
  startAll(): void {
    const plugins = this.registry.getEnabledPlugins()
    for (const plugin of plugins) {
      this.startPlugin(plugin)
    }
    log.info(`MonitorService started with ${plugins.length} plugins`)
  }

  /**
   * 聚合所有插件的状态数据（使用缓存，不重复 fetch）
   */
  aggregateAll(): AggregatedStatus {
    const pollStatuses: MonitorStatus[] = Array.from(this.lastFetchResults.values())

    // 合并 Push 数据（未过期的）
    const now = Date.now()
    const allStatuses: MonitorStatus[] = [...pollStatuses]
    for (const [tool, cached] of this.pushCache) {
      if (cached.expiresAt > now) {
        const pushStatus: MonitorStatus = {
          tool: cached.data.tool,
          status: cached.data.status,
          summary: cached.data.summary,
          details: cached.data.details,
          timestamp: now
        }
        const existing = allStatuses.findIndex((s) => s.tool === tool)
        if (existing >= 0) {
          allStatuses[existing] = pushStatus
        } else {
          allStatuses.push(pushStatus)
        }
      }
    }

    return this.aggregateStatus(allStatuses)
  }

  /**
   * 停止所有定时器
   */
  stopAll(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer)
    }
    this.timers.clear()
    log.info('MonitorService stopped all plugins')
  }

  /**
   * 启动单个插件的轮询
   */
  private startPlugin(plugin: MonitorPlugin): void {
    // 先停止已有的
    this.stopPlugin(plugin.name)

    // 立即执行一次
    this.fetchPluginStatus(plugin)

    // 定时轮询
    const timer = setInterval(() => {
      this.fetchPluginStatus(plugin)
    }, plugin.pollInterval)

    this.timers.set(plugin.name, timer)
  }

  /**
   * 停止单个插件
   */
  private stopPlugin(name: string): void {
    const timer = this.timers.get(name)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(name)
    }
  }

  /**
   * 拉取单个插件的状态
   */
  private async fetchPluginStatus(plugin: MonitorPlugin): Promise<void> {
    try {
      const status = await plugin.fetchStatus()
      this.lastFetchResults.set(plugin.name, status)
    } catch (err) {
      log.warn(`Plugin "${plugin.name}" fetch failed:`, err)
      this.lastFetchResults.set(plugin.name, {
        tool: plugin.name,
        status: 'error',
        summary: `${plugin.name} 获取数据失败`,
        timestamp: Date.now()
      })
    }
    this.emitUpdate()
  }

  /**
   * 处理 Push 推送数据
   */
  handlePush(push: PushStatus): void {
    this.pushCache.set(push.tool, {
      data: push,
      expiresAt: Date.now() + PUSH_TTL_MS
    })
    log.info(`Push received: ${push.tool} = ${push.status} - ${push.summary}`)
    this.emitUpdate()
  }

  /**
   * 获取当前快照（不触发新的 fetch）
   */
  getSnapshot(): AggregatedStatus {
    if (this.latestStatus) {
      return this.latestStatus
    }
    return {
      petState: 'idle',
      tools: [],
      summary: 'DesktopXPet 待机中'
    }
  }

  /**
   * 状态聚合逻辑
   * 优先级: error > working > completed > idle
   */
  private aggregateStatus(allStatuses: MonitorStatus[]): AggregatedStatus {
    const hasError = allStatuses.some((s) => s.status === 'error')
    const isWorking = allStatuses.some((s) => s.status === 'working')
    const hasCompleted = allStatuses.some(
      (s) => s.status === 'completed' && Date.now() - s.timestamp < 30_000
    )

    let petState: 'idle' | 'working' | 'happy' | 'error'
    if (hasError) petState = 'error'
    else if (isWorking) petState = 'working'
    else if (hasCompleted) petState = 'happy'
    else petState = 'idle'

    const summary = this.buildSummary(allStatuses)

    return {
      petState,
      tools: allStatuses,
      summary
    }
  }

  /**
   * 构建摘要文本
   */
  private buildSummary(statuses: MonitorStatus[]): string {
    if (statuses.length === 0) {
      return 'DesktopXPet 待机中'
    }

    const working = statuses.filter((s) => s.status === 'working')
    if (working.length > 0) {
      return working.map((s) => `${s.tool}: ${s.summary}`).join(' | ')
    }

    const errors = statuses.filter((s) => s.status === 'error')
    if (errors.length > 0) {
      return `⚠️ ${errors.length} 个工具出错`
    }

    const completed = statuses.filter(
      (s) => s.status === 'completed' && Date.now() - s.timestamp < 30_000
    )
    if (completed.length > 0) {
      return `✅ ${completed.map((s) => s.tool).join(', ')} 完成`
    }

    return 'DesktopXPet 待机中'
  }

  /**
   * 发出状态更新通知
   */
  private emitUpdate(): void {
    const status = this.aggregateAll()
    this.latestStatus = status
    this.onUpdate?.(status)
  }
}
