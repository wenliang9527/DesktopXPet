import { Config } from './config'
import type { PetNurtureState, StateTransitionConfig, UnlockConfig } from './types'

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

// 养成系统常量
export const NURTURE_DEFAULTS: PetNurtureState = {
  schemaVersion: 1,
  vitals: { mood: 80, satiety: 80, energy: 100, intimacy: 10 },
  growth: { level: 1, xp: 0, xpToNextLevel: 100, totalXp: 0, completedTasks: 0, totalWorkMinutes: 0, pomodorosCompleted: 0 },
  lastUpdate: Date.now(),
}
export const VITAL_DECAY_RATES = { satiety: 0.5 }
export const ENERGY_WORK_DRAIN = 0.3
export const ENERGY_SLEEP_RECOVER = 2
export const XP_REWARDS = { WORK_PER_MINUTE: 1, TASK_COMPLETE: 10, POMODORO_COMPLETE: 15, PET_CLICK: 1, FEED: 3 }
export const LEVEL_XP_BASE = 100
export const LEVEL_XP_MULTIPLIER = 1.5

// 状态切换全局冷却(防止边界值波动导致频繁切换)
export const STATE_TRANSITION_DEFAULT: StateTransitionConfig = {
  globalCooldownMs: 3000,
}

// 解锁配置默认值(启用等级解锁,无自定义阈值)
export const UNLOCK_CONFIG_DEFAULT: UnlockConfig = {
  enabled: true,
}

// 默认解锁阈值表(等级 → 解锁的状态)
// 皮肤 manifest 中每个状态的 unlockLevel 默认为 1,这里只定义扩展状态的默认解锁等级
// 用户可通过 UnlockConfig.customThresholds 覆盖
export const DEFAULT_UNLOCK_THRESHOLDS: Record<string, number> = {
  hungry: 3,
  tired: 3,
  sick: 10,
  sad: 6,
  lonely: 6,
  excited: 6,
  celebrating: 10,
  playing: 8,
  learning: 5,
}

export const DEFAULT_SETTINGS = {
  schemaVersion: 2,
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
  nurture: {
    unlockConfig: { ...UNLOCK_CONFIG_DEFAULT },
    stateTransition: { ...STATE_TRANSITION_DEFAULT },
  },
}
