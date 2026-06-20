// 宠物状态类型
export type PetState = 'idle' | 'working' | 'happy' | 'sleeping' | 'error' | 'waking'

// 监控状态类型
export type MonitorStatusType = 'idle' | 'working' | 'error' | 'completed'

// 单个工具的监控状态
export interface MonitorStatus {
  tool: string
  status: MonitorStatusType
  summary: string
  details?: Record<string, any>
  timestamp: number
}

// 聚合状态
export interface AggregatedStatus {
  petState: PetState
  tools: MonitorStatus[]
  summary: string
  // 是否有"新出现"的 completed 事件（用于通知/声音去重，同一 completed 事件只触发一次）
  newCompleted?: boolean
}

// Push 推送数据
export interface PushStatus {
  tool: string
  status: MonitorStatusType
  summary: string
  details?: Record<string, any>
}

// 皮肤信息
export interface SkinInfo {
  name: string
  author: string
  preview: string
}

// 皮肤动画配置
export interface AnimationConfig {
  frames: number
  fps: number
  loop: boolean
  frameSize?: { width: number; height: number }
}

// 皮肤 manifest
export interface SkinManifest {
  name: string
  author: string
  version: string
  preview: string
  description?: string
  frameSize: { width: number; height: number }
  animations: Record<string, AnimationConfig>
  /** 显示缩放因子 (1.0=原始, >1 放大角色以匹配其他皮肤的视觉大小) */
  displayScale?: number
}

// 皮肤数据（加载后）
export interface SkinData {
  manifest: SkinManifest
  images: Record<string, HTMLImageElement>
  preview: string
}

// 应用设置
export interface AppSettings {
  pet: {
    position: { x: number; y: number } | null
    scale: number
    alwaysOnTop: boolean
    clickSound: boolean
  }
  behavior: {
    sleepAfterMinutes: number
    showNotifications: boolean
    showBubble: boolean
    bubblePosition: 'top' | 'bottom'
  }
  monitor: {
    defaultPollInterval: number
    plugins: Record<
      string,
      {
        enabled: boolean
        config: Record<string, any>
      }
    >
  }
  skin: {
    current: string
    customSkinDirs: string[]
  }
  general: {
    autoStart: boolean
    language: 'zh-CN' | 'en'
    theme: 'auto' | 'light' | 'dark'
  }
}

// 插件接口
export interface MonitorPlugin {
  name: string
  icon: string
  pollInterval: number
  /** 可选：最小轮询间隔 */
  minPollInterval?: number
  /** 可选：最大轮询间隔 */
  maxPollInterval?: number
  /** 可选：根据上次状态动态调整轮询间隔 */
  adjustPollInterval?(lastStatus: MonitorStatus): number
  init?(config: Record<string, any>): Promise<void>
  fetchStatus(): Promise<MonitorStatus>
  dispose?(): Promise<void>
}

// 精灵帧数据
export interface SpriteFrame {
  sx: number
  sy: number
  sw: number
  sh: number
}
