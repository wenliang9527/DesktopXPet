import type { MonitorPlugin, MonitorStatus, MonitorStatusType } from '@shared/types'

// 重新导出插件接口供主进程使用
export type { MonitorPlugin, MonitorStatus, MonitorStatusType }

// 插件配置
export interface PluginConfig {
  enabled: boolean
  config: Record<string, any>
}

// 插件信息（给前端展示）
export interface PluginInfo {
  name: string
  icon: string
  enabled: boolean
  status?: MonitorStatus
  error?: string
}
