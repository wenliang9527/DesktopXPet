/**
 * 应用容器
 * 统一管理所有服务实例，消除 index.ts 中的顶层可变变量
 */
import type { PetWindowManager } from './window'
import type { PluginRegistry } from './monitor/registry'
import type { MonitorService } from './monitor/index'
import type { PetAPIServer } from './server/api'
import type { SkinLoader } from './skin-loader'

export interface AppServices {
  petWindow: PetWindowManager
  pluginRegistry: PluginRegistry
  monitorService: MonitorService
  apiServer: PetAPIServer
  skinLoader: SkinLoader
}

class Container {
  private services: Partial<AppServices> = {}

  register<K extends keyof AppServices>(key: K, service: AppServices[K]): void {
    this.services[key] = service
  }

  get<K extends keyof AppServices>(key: K): AppServices[K] | undefined {
    return this.services[key]
  }
}

export const container = new Container()
