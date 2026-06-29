import { createLogger } from '../utils/logger'
const log = createLogger('PluginScheduler')
import type { MonitorPlugin, MonitorStatus } from '@shared/types'

/**
 * PluginScheduler — 插件调度器
 * 负责插件定时器的管理：启动、停止、错峰启动、动态间隔调整。
 */
export class PluginScheduler {
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map()
  // startAll 错峰启动的待执行 setTimeout 句柄集合,stopAll 时清理避免退出后触发
  private startTimeouts: Set<ReturnType<typeof setTimeout>> = new Set()
  // 用户配置的默认轮询间隔,覆盖各插件硬编码的 pollInterval
  private defaultPollInterval: number

  constructor(defaultPollInterval: number) {
    this.defaultPollInterval = defaultPollInterval
  }

  /**
   * 更新默认轮询间隔（设置变更时调用）
   * 仅更新内部值，由调用方负责重启各插件定时器使新间隔立即生效。
   */
  setDefaultPollInterval(interval: number): void {
    if (interval <= 0 || interval === this.defaultPollInterval) return
    this.defaultPollInterval = interval
  }

  getDefaultPollInterval(): number {
    return this.defaultPollInterval
  }

  /**
   * 错峰启动所有插件
   * 每个插件以 0-2000ms 随机延迟启动,避免同时发起请求造成瞬时资源竞争
   */
  startAllStaggered(plugins: MonitorPlugin[], onStart: (plugin: MonitorPlugin) => void): void {
    for (const plugin of plugins) {
      const delay = Math.floor(Math.random() * 2000)
      const timer = setTimeout(() => {
        this.startTimeouts.delete(timer)
        onStart(plugin)
      }, delay)
      this.startTimeouts.add(timer)
    }
  }

  /**
   * 启动单个插件的轮询
   * 立即触发一次 fetch,然后按计算出的间隔设置定时器
   */
  startPlugin(
    plugin: MonitorPlugin,
    onFetch: (plugin: MonitorPlugin) => void,
    lastStatus?: MonitorStatus
  ): void {
    this.stopPlugin(plugin.name)
    onFetch(plugin)
    this.setPluginTimer(plugin, onFetch, lastStatus)
  }

  /**
   * 重置插件定时器（动态间隔调整时使用）
   * 不触发立即 fetch,仅按新间隔重新设置定时器
   */
  reschedule(
    plugin: MonitorPlugin,
    onFetch: (plugin: MonitorPlugin) => void,
    lastStatus?: MonitorStatus
  ): void {
    this.stopPlugin(plugin.name)
    this.setPluginTimer(plugin, onFetch, lastStatus)
  }

  /**
   * 设置插件定时器（支持动态间隔）
   */
  private setPluginTimer(
    plugin: MonitorPlugin,
    onFetch: (plugin: MonitorPlugin) => void,
    lastStatus?: MonitorStatus
  ): void {
    const currentInterval = this.getPluginInterval(plugin, lastStatus)
    const timer = setInterval(() => {
      onFetch(plugin)
    }, currentInterval)

    this.timers.set(plugin.name, timer)
    log.debug(`[${plugin.name}] Timer set with interval ${currentInterval}ms`)
  }

  /**
   * 获取插件当前轮询间隔（支持动态调整）
   *
   * 取插件自身声明的 pollInterval 与用户配置的 defaultPollInterval 的较大值作为基础值
   * (defaultPollInterval 作为最低频率保证,插件可自行设定更长的间隔),
   * 再由插件的 adjustPollInterval / minPollInterval / maxPollInterval 进行动态调整与上下限保护。
   */
  private getPluginInterval(plugin: MonitorPlugin, lastStatus?: MonitorStatus): number {
    const pluginInterval = plugin.pollInterval || 0
    let interval = Math.max(pluginInterval, this.defaultPollInterval)

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
  stopPlugin(name: string): void {
    const timer = this.timers.get(name)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(name)
    }
  }

  /**
   * 停止所有定时器（含错峰启动的待执行 timeout）
   */
  stopAll(): void {
    // 清理待执行的错峰启动 timeout,避免应用退出后仍触发 startPlugin
    for (const t of this.startTimeouts) {
      clearTimeout(t)
    }
    this.startTimeouts.clear()
    for (const timer of this.timers.values()) {
      clearInterval(timer)
    }
    this.timers.clear()
  }
}
