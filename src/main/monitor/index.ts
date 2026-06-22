import { createLogger } from '../utils/logger'
const log = createLogger('MonitorService')
import type { MonitorPlugin, MonitorStatus, AggregatedStatus, PushStatus } from '@shared/types'
import { PUSH_TTL_MS, DEFAULT_POLL_INTERVAL } from '@shared/constants'
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
  // 已通知过的 completed 事件 key 集合（`${tool}|${timestamp}`），用于通知去重
  private notifiedCompletedKeys: Set<string> = new Set()
  // 用户配置的默认轮询间隔,覆盖各插件硬编码的 pollInterval
  private defaultPollInterval: number

  constructor(registry: PluginRegistry, onUpdate?: (status: AggregatedStatus) => void, defaultPollInterval: number = DEFAULT_POLL_INTERVAL) {
    this.registry = registry
    this.onUpdate = onUpdate
    this.defaultPollInterval = defaultPollInterval
  }

  /**
   * 更新默认轮询间隔并重启所有插件定时器(设置变更时调用)
   */
  setDefaultPollInterval(interval: number): void {
    if (interval <= 0 || interval === this.defaultPollInterval) return
    this.defaultPollInterval = interval
    log.info(`Default poll interval updated to ${interval}ms, restarting all plugin timers`)
    // 重启所有已启用插件的定时器,使新间隔立即生效
    for (const plugin of this.registry.getEnabledPlugins()) {
      this.startPlugin(plugin)
    }
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

    const now = Date.now()
    const allStatuses: MonitorStatus[] = [...pollStatuses]
    for (const [tool, cached] of this.pushCache) {
      if (cached.expiresAt > now) {
        const pushStatus: MonitorStatus = {
          tool: cached.data.tool,
          status: cached.data.status,
          summary: cached.data.summary,
          details: cached.data.details,
          timestamp: now,
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
    this.stopPlugin(plugin.name)
    this.fetchPluginStatus(plugin)
    this.setPluginTimer(plugin)
  }

  /**
   * 设置插件定时器（支持动态间隔）
   */
  private setPluginTimer(plugin: MonitorPlugin): void {
    const currentInterval = this.getPluginInterval(plugin)
    const timer = setInterval(() => {
      this.fetchPluginStatus(plugin)
    }, currentInterval)

    this.timers.set(plugin.name, timer)
    log.debug(`[${plugin.name}] Timer set with interval ${currentInterval}ms`)
  }

  /**
   * 获取插件当前轮询间隔（支持动态调整）
   *
   * 以用户配置的 defaultPollInterval 作为基础值(覆盖插件硬编码的 pollInterval),
   * 再由插件的 adjustPollInterval / minPollInterval / maxPollInterval 进行动态调整与上下限保护。
   */
  private getPluginInterval(plugin: MonitorPlugin): number {
    const lastStatus = this.lastFetchResults.get(plugin.name)
    let interval = this.defaultPollInterval

    if (lastStatus && plugin.adjustPollInterval) {
      interval = plugin.adjustPollInterval(lastStatus)
    }

    if (plugin.minPollInterval) {
      interval = Math.max(interval, plugin.minPollInterval)
    }
    if (plugin.maxPollInterval) {
      interval = Math.min(interval, plugin.maxPollInterval)
    }

    return interval
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

      // 如果插件支持动态间隔调整，重新设置定时器
      if (plugin.adjustPollInterval || plugin.minPollInterval || plugin.maxPollInterval) {
        this.stopPlugin(plugin.name)
        this.setPluginTimer(plugin)
      }
    } catch (err) {
      log.warn(`Plugin "${plugin.name}" fetch failed:`, err)
      this.lastFetchResults.set(plugin.name, {
        tool: plugin.name,
        status: 'error',
        summary: `${plugin.name} 获取数据失败`,
        timestamp: Date.now(),
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
      expiresAt: Date.now() + PUSH_TTL_MS,
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
      summary: 'DesktopXPet 待机中',
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
      summary,
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
   *
   * 通知去重：同一 completed 事件（tool + timestamp）在 30 秒窗口内只标记一次 newCompleted，
   * 避免 happy 状态持续期间每次轮询都重复触发通知/声音。UI 的 petState 动画不受影响。
   *
   * 状态变化检测：如果关键状态字段（petState、tools 的 tool/status/summary、newCompleted）
   * 都没有变化，跳过广播，避免不必要的 IPC 和 React 重渲染。
   */
  private emitUpdate(): void {
    const status = this.aggregateAll()

    const now = Date.now()
    const COMPLETED_WINDOW = 30_000

    // 收集当前 30 秒窗口内的 completed 事件 key
    const currentCompletedKeys = new Set<string>()
    for (const t of status.tools) {
      if (t.status === 'completed' && now - t.timestamp < COMPLETED_WINDOW) {
        currentCompletedKeys.add(`${t.tool}|${t.timestamp}`)
      }
    }

    // 判断是否有"新出现"的 completed 事件（未通知过）
    let hasNew = false
    for (const key of currentCompletedKeys) {
      if (!this.notifiedCompletedKeys.has(key)) {
        hasNew = true
        this.notifiedCompletedKeys.add(key)
      }
    }

    // 清理已通知集合中过期的 key（超过 30 秒窗口），避免集合无限增长
    for (const key of this.notifiedCompletedKeys) {
      const idx = key.lastIndexOf('|')
      if (idx > 0) {
        const ts = Number(key.slice(idx + 1))
        if (now - ts >= COMPLETED_WINDOW) {
          this.notifiedCompletedKeys.delete(key)
        }
      }
    }

    status.newCompleted = hasNew

    // 状态变化检测：只比较结构性字段（petState、tool 列表、各 tool 的 status）。
    // 不比较 summary，因为 summary 可能包含每次轮询都变化的易变值（如 CPU%），
    // 会导致 idle 状态下持续广播。summary 仍会更新到 latestStatus，供 getSnapshot 使用。
    if (this.latestStatus && !hasNew) {
      const prev = this.latestStatus
      const stateChanged = prev.petState !== status.petState
      const toolsChanged =
        prev.tools.length !== status.tools.length ||
        prev.tools.some((t, i) => {
          const cur = status.tools[i]
          return !cur || t.tool !== cur.tool || t.status !== cur.status
        })

      if (!stateChanged && !toolsChanged) {
        // 状态未变化，更新 latestStatus 但不广播
        this.latestStatus = status
        return
      }
    }

    this.latestStatus = status
    log.debug(
      `Status update: petState=${status.petState}, tools=${status.tools.length}, summary="${status.summary}", newCompleted=${hasNew}`
    )
    this.onUpdate?.(status)
  }
}
