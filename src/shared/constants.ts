import { Config } from './config'

// 兼容旧导出（从 Config 派生）
export const APP_NAME = Config.app.name
export const API_PORT = Config.api.port
export const DEFAULT_POLL_INTERVAL = Config.monitoring.defaultPollInterval
export const PUSH_TTL_MS = Config.api.pushTtl
export const PET_WINDOW_WIDTH = Config.window.pet.width
export const PET_WINDOW_HEIGHT = Config.window.pet.height
export const DASHBOARD_WIDTH = Config.window.dashboard.width
export const DASHBOARD_HEIGHT = Config.window.dashboard.height
export const SHUTDOWN_TIMEOUT = Config.monitoring.shutdownTimeout
export const PET_RENDER_SIZE = Config.render.petRenderSize

export const DEFAULT_SETTINGS = {
  pet: {
    position: null,
    scale: 2,
    alwaysOnTop: true,
    clickSound: true,
  },
  behavior: {
    sleepAfterMinutes: 15,
    showNotifications: true,
    showBubble: true,
    bubblePosition: 'bottom' as const,
  },
  monitor: {
    defaultPollInterval: DEFAULT_POLL_INTERVAL,
    plugins: {},
  },
  skin: {
    current: 'default-cat',
    customSkinDirs: [] as string[],
  },
  general: {
    autoStart: false,
    language: 'zh-CN' as const,
    theme: 'auto' as const,
  },
}
