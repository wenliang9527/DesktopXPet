import { BrowserWindow } from 'electron'
import { createLogger } from './utils/logger'
const log = createLogger('NurtureService')
import { storeGet, storeSet, storeLastWriteFailed } from './store'
import { IPC } from '../shared/ipc-channels'
import {
  NURTURE_DEFAULTS,
  VITAL_DECAY_RATES,
  ENERGY_WORK_DRAIN,
  ENERGY_SLEEP_RECOVER,
  XP_REWARDS,
  LEVEL_XP_BASE,
  LEVEL_XP_MULTIPLIER,
  STATE_TRANSITION_DEFAULT,
  UNLOCK_CONFIG_DEFAULT,
  DEFAULT_UNLOCK_THRESHOLDS
} from '../shared/constants'
import type {
  PetNurtureState,
  InteractType,
  PetState,
  PetVitals,
  SkinStateConfig,
  StateTrigger,
  UnlockConfig,
  StateTransitionConfig,
  PetDisplayState,
  NurtureBroadcast
} from '../shared/types'

const VALID_INTERACT_TYPES: ReadonlySet<string> = new Set(['pet', 'feed', 'stroke'])

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v))
}

export class NurtureService {
  private state: PetNurtureState
  private timer: ReturnType<typeof setInterval> | null = null
  private currentPetState: PetState = 'idle'
  private dirty = false
  private lastInteractAt: Record<string, number> = {} // per-type 互动冷却记录
  private persistTimer: ReturnType<typeof setTimeout> | null = null
  private static readonly PERSIST_DEBOUNCE_MS = 5000
  private static readonly INTERACT_COOLDOWN_MS = 3000 // 互动冷却 3 秒
  private static readonly TICK_INTERVAL_MS = 60_000

  // 皮肤状态联动配置(由 bootstrap.ts 在初始化时注入)
  private skinStates: SkinStateConfig[] | undefined
  private unlockConfig: UnlockConfig = { ...UNLOCK_CONFIG_DEFAULT }
  private stateTransitionConfig: StateTransitionConfig = { ...STATE_TRANSITION_DEFAULT }
  // 每个状态上次激活的时间戳,用于冷却判断
  private lastStateChange: Map<string, number> = new Map()
  // 当前活跃事件集合(如 'task_completed'/'pomodoro_completed'),事件触发后短暂保留
  private activeEvents: Set<string> = new Set()
  private eventTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  // 事件保留时长:5 秒后自动清除
  private static readonly EVENT_RETENTION_MS = 5000

  constructor() {
    // 存档可能损坏,用 try/catch 保护避免启动失败
    // 注意:读取 'nurture.state'(运行时状态),而非 'nurture'(配置项命名空间)
    let saved: PetNurtureState | undefined
    try {
      saved = storeGet('nurture.state')
    } catch (err) {
      log.warn('Failed to load nurture state, falling back to defaults:', err)
      saved = undefined
    }
    this.state = saved
      ? {
          ...NURTURE_DEFAULTS,
          ...saved,
          // 嵌套对象深度合并，避免 saved 部分字段缺失时丢失默认值
          vitals: { ...NURTURE_DEFAULTS.vitals, ...saved.vitals },
          growth: { ...NURTURE_DEFAULTS.growth, ...saved.growth },
        }
      : { ...NURTURE_DEFAULTS, lastUpdate: Date.now() }

    // 加载解锁配置和状态切换配置(可能不存在于旧存档,用默认值兜底)
    try {
      const savedUnlock = storeGet('nurture.unlockConfig')
      if (savedUnlock) {
        this.unlockConfig = { ...UNLOCK_CONFIG_DEFAULT, ...savedUnlock }
      }
    } catch {
      // 旧存档无此字段,保持默认值
    }
    try {
      const savedTransition = storeGet('nurture.stateTransition')
      if (savedTransition) {
        this.stateTransitionConfig = { ...STATE_TRANSITION_DEFAULT, ...savedTransition }
      }
    } catch {
      // 旧存档无此字段,保持默认值
    }
  }

  start(): void {
    this.tick()
    this.timer = setInterval(() => this.tick(), NurtureService.TICK_INTERVAL_MS)
    log.info('NurtureService started')
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.persistNow()
    log.info('NurtureService stopped')
  }

  setPetState(state: PetState): void {
    this.currentPetState = state
  }

  /** 注入当前皮肤的 states 配置(皮肤切换时调用) */
  setSkinStates(states: SkinStateConfig[] | undefined): void {
    this.skinStates = states
    // 皮肤切换时清空冷却记录,避免新皮肤的状态被旧冷却阻塞
    this.lastStateChange.clear()
  }

  /** 注入解锁配置 */
  setUnlockConfig(config: UnlockConfig): void {
    this.unlockConfig = { ...config }
  }

  /** 注入状态切换冷却配置 */
  setStateTransitionConfig(config: StateTransitionConfig): void {
    this.stateTransitionConfig = { ...config }
  }

  /**
   * 计算当前等级解锁的状态名列表
   * - unlockConfig.enabled === false 时全部解锁
   * - 否则按 unlockLevel 判断(customThresholds > manifest.unlockLevel > DEFAULT_UNLOCK_THRESHOLDS > 1)
   */
  computeUnlockedStates(
    level: number,
    skinStates: SkinStateConfig[] | undefined,
    unlockConfig: UnlockConfig
  ): string[] {
    if (!skinStates || skinStates.length === 0) return []
    if (!unlockConfig.enabled) {
      return skinStates.map((s) => s.name)
    }
    const custom = unlockConfig.customThresholds ?? {}
    const result: string[] = []
    for (const s of skinStates) {
      const threshold =
        custom[s.name] ?? s.unlockLevel ?? DEFAULT_UNLOCK_THRESHOLDS[s.name] ?? 1
      if (level >= threshold) {
        result.push(s.name)
      }
    }
    return result
  }

  /**
   * 评估单个触发条件是否满足
   * 支持 vital 字段(mood/satiety/energy/intimacy)、level(等级)、event(事件)
   */
  evaluateTrigger(
    trigger: StateTrigger,
    vitals: PetVitals,
    level: number,
    activeEvents: Set<string>
  ): boolean {
    // 事件触发:op 只用 eq/ne,value 是事件名字符串
    if (trigger.field === 'event') {
      const eventName = String(trigger.value)
      const has = activeEvents.has(eventName)
      return trigger.op === 'ne' ? !has : has
    }
    // 等级触发:用 op+value 比较当前等级
    if (trigger.field === 'level') {
      const target = Number(trigger.value)
      switch (trigger.op) {
        case 'lt':
          return level < target
        case 'gt':
          return level > target
        case 'lte':
          return level <= target
        case 'gte':
          return level >= target
        case 'eq':
          return level === target
        case 'ne':
          return level !== target
        default:
          return false
      }
    }
    // vital 触发:原有逻辑
    const actual = vitals[trigger.field]
    const target = Number(trigger.value)
    switch (trigger.op) {
      case 'lt':
        return actual < target
      case 'gt':
        return actual > target
      case 'lte':
        return actual <= target
      case 'gte':
        return actual >= target
      case 'eq':
        return actual === target
      case 'ne':
        return actual !== target
      default:
        return false
    }
  }

  /**
   * 计算宠物当前应显示的状态
   * 决策优先级:monitor(working/error) > monitor(happy) > nurture(已解锁+满足触发+冷却已过) > base
   */
  computePetDisplayState(
    petState: PetState,
    vitals: PetVitals,
    skinStates: SkinStateConfig[] | undefined,
    unlockedStates: string[],
    lastStateChange: Map<string, number>,
    now: number,
    globalCooldownMs: number,
    level: number,
    activeEvents: Set<string>
  ): PetDisplayState {
    // 1. monitor 高优先级状态
    if (petState === 'working' || petState === 'error') {
      return { state: petState, source: 'monitor' }
    }
    // 2. monitor happy
    if (petState === 'happy') {
      return { state: 'happy', source: 'monitor' }
    }

    // 3/4. nurture 状态匹配
    const candidates =
      skinStates?.filter((s) => {
        // 已解锁
        if (!unlockedStates.includes(s.name)) return false
        // sleeping 时只考虑 physiological 类别
        if (petState === 'sleeping' && s.category !== 'physiological') return false
        // triggers 全部满足(AND)
        if (!s.triggers.every((t) => this.evaluateTrigger(t, vitals, level, activeEvents)))
          return false
        // cooldown 已过
        const last = lastStateChange.get(s.name) ?? 0
        const cd = s.cooldownMs ?? globalCooldownMs
        return now - last >= cd
      }) ?? []

    if (candidates.length > 0) {
      // 取 priority 最高的(并列时取第一个)
      const best = candidates.reduce((a, b) => (b.priority > a.priority ? b : a))
      const reason = best.triggers.map((t) => `${t.field}${t.op}${t.value}`).join(',')
      return { state: best.name, source: 'nurture', reason }
    }

    // base 兜底
    if (petState === 'sleeping') {
      return { state: 'sleeping', source: 'base' }
    }
    return { state: 'idle', source: 'base' }
  }

  /**
   * 计算并广播当前显示状态(供 bootstrap.ts 在 MonitorService onUpdate 时调用)
   * 返回计算得到的 displayState,同时通过 IPC.NURTURE_DISPLAY_STATE 广播 NurtureBroadcast 给渲染进程
   * 协议:发送 NurtureBroadcast(含 nurtureState + unlockedStates + displayState)
   */
  computeAndBroadcastDisplayState(): PetDisplayState | undefined {
    if (!this.skinStates) return undefined
    const now = Date.now()
    const level = this.state.growth.level
    const unlockedStates = this.computeUnlockedStates(
      level,
      this.skinStates,
      this.unlockConfig
    )
    const displayState = this.computePetDisplayState(
      this.currentPetState,
      this.state.vitals,
      this.skinStates,
      unlockedStates,
      this.lastStateChange,
      now,
      this.stateTransitionConfig.globalCooldownMs,
      level,
      this.activeEvents
    )
    // 仅当 nurture 来源时记录冷却(避免 monitor/base 状态占用冷却)
    if (displayState.source === 'nurture') {
      this.lastStateChange.set(displayState.state, now)
    }
    const broadcast: NurtureBroadcast = {
      nurtureState: this.getState(),
      unlockedStates,
      displayState,
    }
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.NURTURE_DISPLAY_STATE, broadcast)
      }
    })
    return displayState
  }

  /**
   * 获取当前解锁状态列表(供外部查询)
   */
  getCurrentUnlockedStates(): string[] {
    return this.computeUnlockedStates(
      this.state.growth.level,
      this.skinStates,
      this.unlockConfig
    )
  }

  interact(type: InteractType): PetNurtureState {
    if (!VALID_INTERACT_TYPES.has(type)) {
      log.warn(`Invalid interact type: ${type}`)
      return this.getState()
    }
    // per-type 互动冷却，防止狂点刷 intimacy/XP
    const now = Date.now()
    const lastTime = this.lastInteractAt[type] || 0
    if (now - lastTime < NurtureService.INTERACT_COOLDOWN_MS) {
      // 冷却中，返回当前状态但不修改
      return this.getState()
    }
    this.lastInteractAt[type] = now
    switch (type) {
      case 'pet':
        this.state.vitals.mood = clamp(this.state.vitals.mood + 3)
        this.state.vitals.intimacy = clamp(this.state.vitals.intimacy + 1)
        this.addXp(XP_REWARDS.PET_CLICK)
        break
      case 'feed':
        // 饱食度已满时不修改属性,推送"吃饱了~"反馈
        if (this.state.vitals.satiety >= 100) {
          this.sendInteractFeedback('吃饱了~')
          return this.getState()
        }
        this.state.vitals.satiety = clamp(this.state.vitals.satiety + 20)
        this.state.vitals.mood = clamp(this.state.vitals.mood + 2)
        this.state.vitals.intimacy = clamp(this.state.vitals.intimacy + 1)
        this.addXp(XP_REWARDS.FEED)
        break
      case 'stroke':
        this.state.vitals.mood = clamp(this.state.vitals.mood + 5)
        this.state.vitals.intimacy = clamp(this.state.vitals.intimacy + 2)
        this.addXp(XP_REWARDS.PET_CLICK)
        break
    }
    // 广播 interact 类型,让渲染进程明确触发对应动画(不依赖 satiety 变化量推断,
    // 避免 clamp(satiety+20, max=100) 导致实际增量 < 15 时动画丢失)
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.NURTURE_INTERACT_TRIGGER, type)
      }
    })
    this.broadcast()
    this.schedulePersist()
    return this.getState()
  }

  onTaskCompleted(): void {
    this.state.vitals.mood = clamp(this.state.vitals.mood + 5)
    this.state.growth.completedTasks++
    this.addXp(XP_REWARDS.TASK_COMPLETE)
    this.setActiveEvent('task_completed')
    this.broadcast()
    this.schedulePersist()
  }

  onPomodoroCompleted(): void {
    this.state.vitals.satiety = clamp(this.state.vitals.satiety + 10)
    this.state.growth.pomodorosCompleted++
    this.addXp(XP_REWARDS.POMODORO_COMPLETE)
    this.setActiveEvent('pomodoro_completed')
    this.broadcast()
    this.schedulePersist()
  }

  /**
   * 设置活跃事件,EVENT_RETENTION_MS 后自动清除
   * 事件用于触发 manifest.states 中 field:'event' 的状态(如 celebrating)
   */
  setActiveEvent(eventName: string): void {
    this.activeEvents.add(eventName)
    // 清除旧定时器
    const oldTimer = this.eventTimers.get(eventName)
    if (oldTimer) clearTimeout(oldTimer)
    // 设置新定时器,到期后清除
    const timer = setTimeout(() => {
      this.activeEvents.delete(eventName)
      this.eventTimers.delete(eventName)
      // 事件过期后重算显示状态(可能从 celebrating 回到 idle)
      this.computeAndBroadcastDisplayState()
    }, NurtureService.EVENT_RETENTION_MS)
    this.eventTimers.set(eventName, timer)
  }

  resetPomodoroCount(): void {
    this.state.growth.pomodorosCompleted = 0
    this.broadcast()
    this.schedulePersist()
  }

  getState(): PetNurtureState {
    return { ...this.state, vitals: { ...this.state.vitals }, growth: { ...this.state.growth } }
  }

  private tick(): void {
    const now = Date.now()
    const elapsedMinutes = Math.max(0, (now - this.state.lastUpdate) / 60_000)

    if (elapsedMinutes < 0.5) return

    // 限制单次 tick 最大衰减时长，防止离线过久导致属性直接归零
    const cappedMinutes = Math.min(elapsedMinutes, 120)

    this.state.vitals.satiety -= VITAL_DECAY_RATES.satiety * cappedMinutes

    if (this.currentPetState === 'working') {
      this.state.vitals.energy -= ENERGY_WORK_DRAIN * cappedMinutes
      this.state.growth.totalWorkMinutes += cappedMinutes
      this.addXp(XP_REWARDS.WORK_PER_MINUTE * cappedMinutes)
    } else if (this.currentPetState === 'sleeping') {
      this.state.vitals.energy += ENERGY_SLEEP_RECOVER * cappedMinutes
    }

    if (this.state.vitals.satiety < 20) {
      this.state.vitals.mood -= 1 * cappedMinutes
    }

    this.clampVitals()
    this.state.lastUpdate = now
    this.broadcast()
    this.schedulePersist()
  }

  private addXp(amount: number): void {
    this.state.growth.xp += amount
    this.state.growth.totalXp += amount
    this.checkLevelUp()
  }

  private checkLevelUp(): void {
    let leveledUp = false
    while (this.state.growth.xp >= this.state.growth.xpToNextLevel) {
      this.state.growth.xp -= this.state.growth.xpToNextLevel
      this.state.growth.level++
      this.state.growth.xpToNextLevel = Math.floor(
        LEVEL_XP_BASE * Math.pow(LEVEL_XP_MULTIPLIER, this.state.growth.level - 1)
      )
      leveledUp = true
      log.info(`Level up! Now level ${this.state.growth.level}`)
    }
    // 等级提升时广播皮肤列表变更,让渲染进程重新拉取已解锁皮肤列表
    // (新等级可能解锁 unlockLevel 更高的皮肤,如婚纱皮肤 Lv10)
    if (leveledUp) {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC.SKIN_LIST_CHANGED)
        }
      })
      // 主动重算并广播 displayState:新等级可能解锁新 nurture 状态(如 Lv3 解锁 hungry)
      // 不等下次 tick/interact,让新状态立即生效
      if (this.skinStates) {
        this.computeAndBroadcastDisplayState()
      }
    }
  }

  private clampVitals(): void {
    const v = this.state.vitals
    v.mood = clamp(v.mood)
    v.satiety = clamp(v.satiety)
    v.energy = clamp(v.energy)
    v.intimacy = clamp(v.intimacy)
  }

  private broadcast(): void {
    // 如果已注入皮肤 states 配置,通过 computeAndBroadcastDisplayState 广播
    // NurtureBroadcast(已内嵌 nurtureState),避免双重 IPC 广播
    if (this.skinStates) {
      this.computeAndBroadcastDisplayState()
      return
    }
    // 无 skinStates(旧皮肤)时,仅广播 nurtureState
    const nurtureState = this.getState()
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.NURTURE_STATE_UPDATE, nurtureState)
      }
    })
  }

  /**
   * 推送互动反馈消息到渲染进程(如"吃饱了~"),由 StatusBubble 显示气泡
   * 用于互动被拒绝时的用户反馈,避免静默忽略
   */
  private sendInteractFeedback(message: string): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.NURTURE_INTERACT_FEEDBACK, message)
      }
    })
  }

  private schedulePersist(): void {
    this.dirty = true
    if (this.persistTimer) return
    this.persistTimer = setTimeout(() => {
      this.persistNow()
    }, NurtureService.PERSIST_DEBOUNCE_MS)
  }

  private persistNow(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer)
      this.persistTimer = null
    }
    if (!this.dirty) return
    // storeSet 返回是否写入成功;store 的 _write 在 EPERM 时静默吞掉异常,
    // 但会设置 __lastWriteFailed 标志,storeSet 据此返回 false。
    // 注意:写入 'nurture.state'(运行时状态),与 'nurture.unlockConfig'/
    // 'nurture.stateTransition'(配置项)分离,避免结构冲突。
    const ok = storeSet('nurture.state', this.state)
    if (ok && !storeLastWriteFailed()) {
      this.dirty = false
    } else {
      // 写入失败(如 Windows EPERM 被杀毒软件拦截):保留 dirty 标志,
      // 下次 tick(最多 60 秒后)会自动重试。避免数据丢失。
      log.warn('Failed to persist nurture state (will retry on next tick)')
    }
  }
}
