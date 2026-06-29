// 互动类型
export type InteractType = 'pet' | 'feed' | 'stroke'

// 宠物养成属性
export interface PetVitals {
  mood: number // 心情 0-100
  satiety: number // 饱食度 0-100
  energy: number // 精力 0-100
  intimacy: number // 亲密度 0-100
}

// 宠物成长数据
export interface PetGrowth {
  level: number
  xp: number
  xpToNextLevel: number
  totalXp: number
  completedTasks: number
  totalWorkMinutes: number
  pomodorosCompleted: number
}

// 养成系统完整状态
export interface PetNurtureState {
  schemaVersion: number // 存档 schema 版本号，用于未来字段变更时迁移旧存档
  vitals: PetVitals
  growth: PetGrowth
  lastUpdate: number
}

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

// 静态动画效果类型
export type StaticEffectType = 'float' | 'breathe' | 'sway' | 'bounce'

export interface StaticEffect {
  type: StaticEffectType
  speed?: number    // 动画速度倍率 (默认 1.0)
  intensity?: number // 效果强度 (默认值因效果而异)
}

export interface StaticAnimationConfig {
  effects: StaticEffect[]
  duration?: number // 持续时间(秒),用于非循环动画(如 happy)
}

// 精灵图动画配置 (逐帧模式)
export interface SpritesheetAnimationConfig {
  frames: number
  fps: number
  loop: boolean
  frameSize?: { width: number; height: number }
}

// 动画配置：精灵图模式 或 静态模式
export type AnimationConfig = SpritesheetAnimationConfig | StaticAnimationConfig

/** 运行时判断是否为静态动画配置 */
export function isStaticAnimationConfig(config: AnimationConfig): config is StaticAnimationConfig {
  return 'effects' in config
}

// 声明式互动动作:皮肤可声明每个触发方式对应的动作图与优先级
export interface SkinAction {
  // 动作名,如 'jump'/'eat'/'stroke'/'custom'
  name: string
  // 触发方式
  trigger: 'click' | 'feed' | 'stroke'
  // 对应 PNG 文件名(不含扩展名),如 'jump'
  image: string
  // 优先级,数字越大越优先
  priority: number
}

// 状态触发条件(AND 组合)
// field 扩展支持 'level'(等级触发)和 'event'(事件触发)
// - vital 字段(mood/satiety/energy/intimacy):用 op+value 比较数值
// - 'level':用 op+value 比较当前等级(如 {field:'level',op:'gte',value:5} 表示 Lv5+)
// - 'event':用 value 匹配事件名(如 {field:'event',op:'eq',value:'task_completed'})
//   op 只用 'eq'/'ne',value 是事件名字符串
export interface StateTrigger {
  field: 'mood' | 'satiety' | 'energy' | 'intimacy' | 'level' | 'event'
  op: 'lt' | 'gt' | 'lte' | 'gte' | 'eq' | 'ne'
  value: number | string
}

// 皮肤状态配置(manifest 中声明)
export interface SkinStateConfig {
  name: string
  image: string
  category: 'emotion' | 'physiological' | 'behavior'
  triggers: StateTrigger[]
  priority: number
  unlockLevel: number
  cooldownMs?: number
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
  /** 渲染模式: 'spritesheet'(逐帧精灵图,默认) 或 'static'(静态立绘+Canvas动画) */
  renderMode?: 'spritesheet' | 'static'
  /** 声明式互动动作:可选,旧 manifest 无此字段时走默认动作(jump/eat/stroke) */
  actions?: SkinAction[]
  /** 皮肤状态配置:可选,旧 manifest 无此字段时行为不变 */
  states?: SkinStateConfig[]
  /** 皮肤解锁等级(皮肤级别):未达到等级的皮肤在 SkinSelector 中完全隐藏。默认 1 */
  unlockLevel?: number
}

// 解锁配置(可配置解锁节奏)
export interface UnlockConfig {
  /** 是否启用等级解锁,false 则全部解锁 */
  enabled: boolean
  /** 自定义状态解锁等级 { hungry: 2, sad: 5 } */
  customThresholds?: Record<string, number>
}

// 状态切换冷却配置
export interface StateTransitionConfig {
  /** 全局默认冷却 ms(默认 3000) */
  globalCooldownMs: number
}

// 宠物显示状态决策结果
export interface PetDisplayState {
  /** 最终显示状态名(如 'hungry'/'idle'/'working') */
  state: string
  /** 状态来源:监控/养成/基础兜底 */
  source: 'monitor' | 'nurture' | 'base'
  /** 触发原因(调试用,如 'satiety<20') */
  reason?: string
}

// 养成广播数据(扩展 nurtureState)
export interface NurtureBroadcast {
  nurtureState: PetNurtureState
  /** 当前等级解锁的状态名列表 */
  unlockedStates: string[]
  /** 主进程侧计算的显示状态(可选,渲染进程可重算) */
  displayState?: PetDisplayState
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
  nurture: {
    unlockConfig: UnlockConfig
    stateTransition: StateTransitionConfig
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
