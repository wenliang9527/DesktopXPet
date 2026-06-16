export const APP_NAME = 'DesktopXPet'
export const API_PORT = 9527
export const DEFAULT_POLL_INTERVAL = 30000
export const PUSH_TTL_MS = 60000
export const PET_WINDOW_WIDTH = 220
export const PET_WINDOW_HEIGHT = 280
export const DASHBOARD_WIDTH = 800
export const DASHBOARD_HEIGHT = 600
export const SHUTDOWN_TIMEOUT = 5000
export const PET_RENDER_SIZE = 128

export const DEFAULT_SETTINGS = {
  pet: {
    position: null,
    scale: 2,
    alwaysOnTop: true,
    clickSound: true
  },
  behavior: {
    sleepAfterMinutes: 15,
    showNotifications: true,
    showBubble: true,
    bubblePosition: 'bottom' as const
  },
  monitor: {
    defaultPollInterval: DEFAULT_POLL_INTERVAL,
    plugins: {}
  },
  skin: {
    current: 'default-cat',
    customSkinDirs: [] as string[]
  },
  general: {
    autoStart: false,
    language: 'zh-CN' as const,
    theme: 'auto' as const
  }
}
