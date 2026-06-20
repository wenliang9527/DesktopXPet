import { createLogger } from '../utils/logger'
const log = createLogger('PluginRegistry')
import type { MonitorPlugin } from '@shared/types'
import type { PluginConfig, PluginInfo } from '@shared/plugin-api'

/**
 * PluginRegistry — 插件注册中心
 * 管理插件的注册、加载、卸载、配置更新
 */
export class PluginRegistry {
  private plugins: Map<string, MonitorPlugin> = new Map()
  private configs: Map<string, PluginConfig> = new Map()

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
   */
  togglePlugin(name: string, enabled: boolean): void {
    const config = this.configs.get(name)
    if (config) {
      config.enabled = enabled
      log.info(`Plugin "${name}" ${enabled ? 'enabled' : 'disabled'}`)
    }
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
   * 初始化所有已启用插件
   */
  async initAll(): Promise<void> {
    for (const plugin of this.getEnabledPlugins()) {
      try {
        const config = this.configs.get(plugin.name)?.config || {}
        await plugin.init?.(config)
        log.info(`Plugin initialized: ${plugin.name}`)
      } catch (err) {
        log.error(`Plugin "${plugin.name}" init failed:`, err)
      }
    }
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
