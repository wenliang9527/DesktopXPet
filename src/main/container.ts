/**
 * 应用容器
 * 统一管理所有服务实例，消除 index.ts 中的顶层可变变量
 */
import type { PetWindowManager } from './window'
import type { PluginRegistry } from './monitor/registry'
import type { MonitorService } from './monitor/index'
import type { PetAPIServer } from './server/api'
import type { SkinLoader } from './skin-loader'
import type { NurtureService } from './nurture'

export interface AppServices {
  petWindow: PetWindowManager
  pluginRegistry: PluginRegistry
  monitorService: MonitorService
  apiServer: PetAPIServer
  skinLoader: SkinLoader
  nurtureService: NurtureService
}

class Container {
  private services: Partial<AppServices> = {}

  register<K extends keyof AppServices>(key: K, service: AppServices[K]): void {
    this.services[key] = service
  }

  get<K extends keyof AppServices>(key: K): AppServices[K] | undefined {
    return this.services[key]
  }

  /**
   * 断言式获取:服务不存在时抛异常,适用于初始化阶段必需的服务
   * 避免调用方到处使用 ?. 可选链
   */
  require<K extends keyof AppServices>(key: K): AppServices[K] {
    const service = this.services[key]
    if (!service) {
      throw new Error(`Required service "${String(key)}" is not registered`)
    }
    return service
  }
}

export const container = new Container()
