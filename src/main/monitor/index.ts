import { createLogger } from '../utils/logger'
const log = createLogger('MonitorService')
import type { MonitorPlugin, MonitorStatus, AggregatedStatus, PushStatus } from '@shared/types'
import { PUSH_TTL_MS, DEFAULT_POLL_INTERVAL } from '@shared/constants'
import { PluginRegistry } from './registry'
import { PluginScheduler } from './scheduler'
import { StatusAggregator } from './aggregator'
import { EventDeduplicator } from './deduplicator'
import { StatusBroadcaster } from './broadcaster'
import { PushDataManager } from './push-data-manager'

/**
 * MonitorService — 监控调度器（协调器）
 * 组合 PluginScheduler / StatusAggregator / EventDeduplicator / StatusBroadcaster / PushDataManager，
 * 编排插件定时轮询、状态聚合、事件去重与状态广播。
 */
export class MonitorService {
  private registry: PluginRegistry
  private scheduler: PluginScheduler
  private aggregator: StatusAggregator
  private deduplicator: EventDeduplicator
  private broadcaster: StatusBroadcaster
  private pushDataManager: PushDataManager
  // 各插件最近一次轮询获取的状态
  private lastFetchResults: Map<string, MonitorStatus> = new Map()

  constructor(
    registry: PluginRegistry,
    onUpdate?: (status: AggregatedStatus) => void,
    defaultPollInterval: number = DEFAULT_POLL_INTERVAL
  ) {
    this.registry = registry
    this.scheduler = new PluginScheduler(defaultPollInterval)
    this.aggregator = new StatusAggregator()
    this.deduplicator = new EventDeduplicator()
    this.broadcaster = new StatusBroadcaster(onUpdate)
    this.pushDataManager = new PushDataManager(PUSH_TTL_MS)
    // 注册插件启停回调,使 togglePlugin 能实际启停插件定时器与生命周期
    this.registry.onToggle = (name, enabled) => this.handleToggle(name, enabled)
  }

  /**
   * 启动所有插件的定时轮询
   * 每个插件以 0-2000ms 随机延迟错峰启动,避免同时发起请求造成瞬时资源竞争
   */
  startAll(): void {
    const plugins = this.registry.getEnabledPlugins()
    this.scheduler.startAllStaggered(plugins, (p) => this.startPlugin(p))
    // 启动定期强制同步（每 30 秒广播一次当前状态，保证渲染进程最终一致）
    this.broadcaster.startSyncTimer()
    log.info(`MonitorService started with ${plugins.length} plugins`)
  }

  /**
   * 停止所有定时器
   */
  stopAll(): void {
    this.scheduler.stopAll()
    this.broadcaster.stopSyncTimer()
    log.info('MonitorService stopped all plugins')
  }

  /**
   * 更新默认轮询间隔并重启所有插件定时器(设置变更时调用)
   */
  setDefaultPollInterval(interval: number): void {
    if (interval <= 0 || interval === this.scheduler.getDefaultPollInterval()) return
    this.scheduler.setDefaultPollInterval(interval)
    log.info(`Default poll interval updated to ${interval}ms, restarting all plugin timers`)
    // 重启所有已启用插件的定时器,使新间隔立即生效
    for (const plugin of this.registry.getEnabledPlugins()) {
      this.startPlugin(plugin)
    }
  }

  /**
   * 处理 Push 推送数据
   */
  handlePush(push: PushStatus): void {
    this.pushDataManager.set(push)
    log.info(`Push received: ${push.tool} = ${push.status} - ${push.summary}`)
    this.emitUpdate()
  }

  /**
   * 聚合所有插件的状态数据（使用缓存，不重复 fetch）
   */
  aggregateAll(): AggregatedStatus {
    const now = Date.now()
    const pollStatuses = Array.from(this.lastFetchResults.values())
    const pushStatuses = this.pushDataManager.getValidStatuses(now)
    const allStatuses = this.mergeStatuses(pollStatuses, pushStatuses)
    return this.aggregator.aggregate(allStatuses)
  }

  /**
   * 获取当前快照（不触发新的 fetch）
   */
  getSnapshot(): AggregatedStatus {
    return this.broadcaster.getSnapshot()
  }

  // ─── 内部编排方法 ──────────────────────────────────────────

  /**
   * 启动单个插件的轮询
   */
  private startPlugin(plugin: MonitorPlugin): void {
    const lastStatus = this.lastFetchResults.get(plugin.name)
    this.scheduler.startPlugin(plugin, (p) => this.fetchPluginStatus(p), lastStatus)
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
        this.scheduler.reschedule(plugin, (p) => this.fetchPluginStatus(p), status)
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
   * 发出状态更新通知
   *
   * 流程：
   *   1. 清理 pushCache 过期条目
   *   2. 聚合状态
   *   3. 检测新 completed 事件（30 秒窗口内去重，避免 happy 期间重复通知）
   *   4. 清理 notifiedCompletedKeys 过期 key
   *   5. 广播决策（与上次状态对比，未变化则跳过以减少 IPC 与 React 重渲染）
   */
  private emitUpdate(): void {
    const now = Date.now()
    this.pushDataManager.cleanExpired(now)

    const status = this.aggregateAll()
    const hasNew = this.deduplicator.detectNewCompleted(status, now)
    this.deduplicator.cleanup(now)
    status.newCompleted = hasNew

    this.broadcaster.broadcast(status, hasNew, now)
  }

  /**
   * 合并轮询状态与推送状态（推送状态覆盖同 tool 的轮询状态）
   */
  private mergeStatuses(
    pollStatuses: MonitorStatus[],
    pushStatuses: MonitorStatus[]
  ): MonitorStatus[] {
    const result = [...pollStatuses]
    for (const pushStatus of pushStatuses) {
      const existing = result.findIndex((s) => s.tool === pushStatus.tool)
      if (existing >= 0) {
        result[existing] = pushStatus
      } else {
        result.push(pushStatus)
      }
    }
    return result
  }

  /**
   * 处理插件启停(由 PluginRegistry.togglePlugin 触发)
   *
   * 启用:调用 plugin.init(config) 后启动该插件的定时轮询
   * 禁用:清除定时器、从 lastFetchResults 删除状态、调用 plugin.dispose()
   */
  private handleToggle(name: string, enabled: boolean): void {
    const plugin = this.registry.getPlugin(name)
    if (!plugin) {
      log.warn(`Toggle unknown plugin: ${name}`)
      return
    }
    if (enabled) {
      const config = this.registry.getPluginConfig(name)
      plugin
        .init?.(config)
        .then(() => {
          this.startPlugin(plugin)
          log.info(`Plugin "${name}" started via toggle`)
        })
        .catch((err) => {
          log.error(`Plugin "${name}" init failed on toggle:`, err)
        })
    } else {
      this.scheduler.stopPlugin(name)
      this.lastFetchResults.delete(name)
      plugin
        .dispose?.()
        .catch((err) => log.warn(`Plugin "${name}" dispose failed on toggle:`, err))
      log.info(`Plugin "${name}" stopped via toggle`)
      this.emitUpdate()
    }
  }
}
