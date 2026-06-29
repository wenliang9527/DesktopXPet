import { createLogger } from '../utils/logger'
const log = createLogger('PluginRegistry')
import type { MonitorPlugin } from '@shared/types'
import type { PluginConfig, PluginInfo } from '@shared/plugin-api'
import { getStore } from '../store'

/**
 * PluginRegistry — 插件注册中心
 * 管理插件的注册、加载、卸载、配置更新
 */
export class PluginRegistry {
  private plugins: Map<string, MonitorPlugin> = new Map()
  private configs: Map<string, PluginConfig> = new Map()
  /**
   * 插件启停回调,由 MonitorService 注册。
   * togglePlugin 在更新配置后会调用此回调,使外部能实际启停定时器与插件生命周期。
   */
  onToggle?: (name: string, enabled: boolean) => void

  /**
   * 注册插件
   */
  register(plugin: MonitorPlugin, config?: PluginConfig): void {
    this.plugins.set(plugin.name, plugin)
    this.configs.set(plugin.name, config || { enabled: true, config: {} })
    log.info(`Plugin registered: ${plugin.name}`)
  }

  /**
   * 卸载插件
   */
  async unregister(name: string): Promise<void> {
    const plugin = this.plugins.get(name)
    if (plugin) {
      try {
        await plugin.dispose?.()
      } catch (err) {
        log.warn(`Plugin "${name}" dispose failed:`, err)
      }
      this.plugins.delete(name)
      this.configs.delete(name)
      log.info(`Plugin unregistered: ${name}`)
    }
  }

  /**
   * 获取所有已注册且已启用的插件
   */
  getEnabledPlugins(): MonitorPlugin[] {
    const result: MonitorPlugin[] = []
    for (const [name, plugin] of this.plugins) {
      const config = this.configs.get(name)
      if (config?.enabled !== false) {
        result.push(plugin)
      }
    }
    return result
  }

  /**
   * 获取所有插件信息
   */
  getPluginInfos(): PluginInfo[] {
    const infos: PluginInfo[] = []
    for (const [name, plugin] of this.plugins) {
      const config = this.configs.get(name)
      infos.push({
        name: plugin.name,
        icon: plugin.icon,
        enabled: config?.enabled !== false,
      })
    }
    return infos
  }

  /**
   * 启用/禁用插件
   * 同时持久化到 store 并通过 onToggle 回调通知 MonitorService 启停定时器与生命周期
   */
  togglePlugin(name: string, enabled: boolean): void {
    const config = this.configs.get(name)
    if (config) {
      config.enabled = enabled
      // 持久化到 store,使设置在重启后仍然生效
      try {
        getStore().set(`monitor.plugins.${name}.enabled`, enabled)
      } catch (err) {
        log.warn(`Failed to persist plugin "${name}" enabled state:`, err)
      }
      log.info(`Plugin "${name}" ${enabled ? 'enabled' : 'disabled'}`)
      // 通知外部(MonitorService)实际启停插件
      this.onToggle?.(name, enabled)
    }
  }

  /**
   * 获取插件配置(供 MonitorService 在 toggle 启用时传入 plugin.init)
   */
  getPluginConfig(name: string): Record<string, any> {
    return this.configs.get(name)?.config || {}
  }

  /**
   * 更新插件配置
   */
  updateConfig(name: string, config: Record<string, any>): void {
    const existing = this.configs.get(name)
    if (existing) {
      existing.config = { ...existing.config, ...config }
    }
  }

  /**
   * 获取插件实例
   */
  getPlugin(name: string): MonitorPlugin | undefined {
    return this.plugins.get(name)
  }

  /**
   * 初始化所有已启用插件（并行）
   */
  async initAll(): Promise<void> {
    const plugins = this.getEnabledPlugins()
    await Promise.allSettled(
      plugins.map(async (plugin) => {
        try {
          const config = this.configs.get(plugin.name)?.config || {}
          await plugin.init?.(config)
          log.info(`Plugin initialized: ${plugin.name}`)
        } catch (err) {
          log.error(`Plugin "${plugin.name}" init failed:`, err)
        }
      })
    )
  }

  /**
   * 清理所有插件
   */
  async disposeAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      try {
        await plugin.dispose?.()
      } catch (err) {
        log.warn(`Plugin "${plugin.name}" dispose failed:`, err)
      }
    }
  }
}
