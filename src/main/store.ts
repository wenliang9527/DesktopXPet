import ElectronStore from 'electron-store'
import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { DEFAULT_SETTINGS } from '@shared/constants'
import type { PetNurtureState, UnlockConfig, StateTransitionConfig } from '../shared/types'

/**
 * store 实例接口:包含 electron-store 的公共方法 + 我们需要访问的内部字段。
 *
 * 注意:不能写成 `InstanceType<typeof ElectronStore> & InternalStore`,
 * 因为 electron-store 内部有 private 的 _serialize/_write,与 InternalStore
 * 中同名属性在交叉类型中会因可见性冲突导致整个类型坍缩为 never。
 * 因此这里独立定义接口,通过 `as unknown as StoreInstance` 断言访问。
 */
interface StoreInstance {
  // electron-store 公共方法
  set: (key: string, value: unknown) => void
  get: (key: string, defaultValue?: unknown) => unknown
  has: (key: string) => boolean
  delete: (key: string) => void
  // electron-store 整个数据对象的 getter(返回所有键值对)
  store: Record<string, unknown>
  // electron-store 内部字段(通过类型断言访问)
  _write: (value: unknown) => void
  _serialize: (value: unknown) => string
  path: string
  // 自定义标志
  __memoryMode?: boolean
  __lastWriteFailed?: boolean
}

// electron-store ESM default export 兼容处理
const Store = (ElectronStore as unknown as { default?: typeof ElectronStore }).default || ElectronStore

let store: StoreInstance | null = null

/** electron-store 的类型安全 schema */
export interface StoreSchema {
  // store schema 版本号(用于一次性数据迁移)
  'schemaVersion': number
  // 皮肤
  'skin.current': string
  'skin.customSkinDirs': string[]
  // 宠物
  'pet.position': { x: number; y: number } | null
  'pet.scale': number
  'pet.alwaysOnTop': boolean
  'pet.clickSound': boolean
  // 通用
  'general.petName': string
  'general.autoStart': boolean
  // 行为
  'behavior.showNotifications': boolean
  'behavior.showBubble': boolean
  // 监控
  'monitor.defaultPollInterval': number
  'monitor.plugins.github.enabled': boolean
  'monitor.plugins.github.config.username': string
  // 养成
  // 注意:'nurture.state' 存储运行时状态(PetNurtureState),与 'nurture.unlockConfig'/
  // 'nurture.stateTransition'(配置项)分离,避免结构冲突导致读取到错误数据
  'nurture.state': PetNurtureState
  'nurture.unlockConfig': UnlockConfig
  'nurture.stateTransition': StateTransitionConfig
  // 番茄钟
  'pomodoros.completed': number
}

export function initStore(): StoreInstance {
  if (!store) {
    // 构造时也可能因 EPERM(杀毒软件/文件锁定)失败:conf 在 #initializeStore 阶段
    // 会尝试写入 defaults,此时 _write 回退尚未包装,异常会直接抛出导致应用启动失败。
    // 处理策略:构造失败则改用 cwd=内存模式(无持久化),保证应用能启动。
    let s: StoreInstance
    try {
      s = new Store({
        name: 'desktopxpet-config',
        defaults: DEFAULT_SETTINGS,
      }) as unknown as StoreInstance
    } catch (constructErr) {
      const recoverableCodes = new Set(['EXDEV', 'EPERM', 'EACCES', 'EBUSY'])
      const err = constructErr as NodeJS.ErrnoException
      if (err?.code && recoverableCodes.has(err.code)) {
        // 磁盘 store 不可用,退化为内存 store。
        // 数据来源优先级:Temp memory 文件(上次内存模式写入) > Roaming 磁盘文件 > DEFAULT_SETTINGS
        // 这样即使 Roaming 持续 EPERM,内存模式期间写入的数据下次启动仍能恢复。
        let recoveredData: Record<string, unknown> = {}
        try {
          const memoryPath = join(app.getPath('temp'), 'desktopxpet-config-memory.json')
          const raw = fs.readFileSync(memoryPath, 'utf-8')
          recoveredData = JSON.parse(raw)
        } catch {
          // Temp memory 文件不存在,尝试读取 Roaming 磁盘文件
          try {
            const configPath = join(app.getPath('userData'), 'desktopxpet-config.json')
            const raw = fs.readFileSync(configPath, 'utf-8')
            recoveredData = JSON.parse(raw)
          } catch {
            // 都读取失败,用 DEFAULT_SETTINGS
          }
        }
        s = new Store({
          name: 'desktopxpet-config-memory',
          defaults: { ...DEFAULT_SETTINGS, ...recoveredData },
          cwd: app.getPath('temp'), // 写入临时目录,避免原锁定文件
        }) as unknown as StoreInstance
        // 标记为内存模式:后续 _write 会尝试写入 temp 路径(保底持久化)
        s.__memoryMode = true
      } else {
        throw constructErr
      }
    }
    store = s

    // 覆盖 _write 方法：扩展 atomically 失败时的回退逻辑
    // conf 原生只处理 EXDV 回退，Windows 上 EPERM（杀毒软件/文件锁定）也会导致原子写入失败
    // 这里扩展为：EXDEV、EPERM、EACCES 都回退到普通 fs.writeFileSync
    const originalWrite = s._write.bind(s)
    s._write = function (value: unknown) {
      // 内存模式:Roaming 路径不可写,但 temp 路径通常可写。
      // 尝试直接写入 temp 路径(s.path 指向 temp 目录),保底持久化数据,
      // 下次启动时构造函数会优先读取 temp memory 文件恢复数据。
      if (s.__memoryMode) {
        try {
          const data = s._serialize(value)
          fs.writeFileSync(s.path, data, { mode: 0o666 })
          s.__lastWriteFailed = false
        } catch {
          // temp 路径也不可写(极端情况):静默丢弃,标记写入失败,
          // 让调用方(NurtureService.persistNow)能感知并保留 dirty 重试。
          s.__lastWriteFailed = true
        }
        return
      }
      try {
        originalWrite(value)
        s.__lastWriteFailed = false
      } catch (rawError) {
        const recoverableCodes = new Set(['EXDEV', 'EPERM', 'EACCES', 'EBUSY'])
        const error = rawError as NodeJS.ErrnoException
        if (error?.code && recoverableCodes.has(error.code)) {
          try {
            const data = s._serialize(value)
            fs.writeFileSync(s.path, data, { mode: 0o666 })
            s.__lastWriteFailed = false
            return
          } catch {
            // 回退也失败:静默丢弃(避免每5秒刷屏),但标记写入失败,
            // 让调用方(如 NurtureService.persistNow)能感知并保留 dirty 重试。
            s.__lastWriteFailed = true
            return
          }
        }
        s.__lastWriteFailed = true
        throw error
      }
    }

    // 一次性数据迁移:旧默认值 30000 → 10000(schemaVersion < 2)
    // schemaVersion 未写入或 < 2 时,将旧默认值 30000 迁移为 10000 并更新 schemaVersion。
    // 写入失败时 schemaVersion 不会更新(下次启动重试),但值已改为 10000 不会重复匹配。
    // 用户显式设置 30000 在迁移完成后(schemaVersion=2)不再被覆盖。
    const currentSchemaVersion = (s.get('schemaVersion') as number | undefined) ?? 1
    if (currentSchemaVersion < 2) {
      const stored = s.get('monitor.defaultPollInterval')
      if (stored === 30000) {
        try {
          s.set('monitor.defaultPollInterval', 10000)
        } catch {
          // 写入失败不阻塞,下次启动重试
        }
      }
      try {
        s.set('schemaVersion', 2)
      } catch {
        // 写入失败不阻塞,下次启动重试
      }
    }
  }
  return store
}

export function getStore(): StoreInstance {
  if (!store) {
    return initStore()
  }
  return store
}

/** 类型安全的 store.get */
export function storeGet<K extends keyof StoreSchema>(key: K): StoreSchema[K] | undefined
export function storeGet<K extends keyof StoreSchema>(key: K, defaultValue: StoreSchema[K]): StoreSchema[K]
export function storeGet(key: string, defaultValue?: unknown): unknown {
  return getStore().get(key, defaultValue)
}

/**
 * 检查上一次 store 写入是否成功。
 * store 的 _write 在 EPERM 等错误时会静默吞掉异常(避免刷屏),
 * 调用方可通过此函数感知写入失败,决定是否保留 dirty 重试。
 */
export function storeLastWriteFailed(): boolean {
  return getStore().__lastWriteFailed === true
}

/** 类型安全的 store.set,返回是否写入成功 */
export function storeSet<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): boolean {
  const s = getStore()
  // 重置标志,由 _write 设置
  s.__lastWriteFailed = false
  try {
    s.set(key, value)
  } catch {
    // _write 抛出的异常(非 EPERM 类)直接视为失败
    s.__lastWriteFailed = true
  }
  return !s.__lastWriteFailed
}

/**
 * 读取 monitor.defaultPollInterval。
 *
 * 旧默认值 30000 → 10000 的迁移已在 initStore 中通过 schemaVersion 一次性完成,
 * 此函数仅返回存储值(默认 10000)。用户显式设置的值不会被覆盖。
 */
export function getEffectivePollInterval(): number {
  return storeGet('monitor.defaultPollInterval') ?? 10000
}
