import ElectronStore from 'electron-store'
import fs from 'fs'
import { DEFAULT_SETTINGS } from '@shared/constants'

// electron-store ESM default export 兼容处理
const Store = (ElectronStore as any).default || ElectronStore

let store: InstanceType<typeof ElectronStore> | null = null

export function initStore(): NonNullable<InstanceType<typeof ElectronStore>> {
  if (!store) {
    const s = new Store({
      name: 'desktopxpet-config',
      defaults: DEFAULT_SETTINGS as any,
    })
    store = s as NonNullable<InstanceType<typeof ElectronStore>>

    // 覆盖 _write 方法：扩展 atomically 失败时的回退逻辑
    // conf 原生只处理 EXDV 回退，Windows 上 EPERM（杀毒软件/文件锁定）也会导致原子写入失败
    // 这里扩展为：EXDEV、EPERM、EACCES 都回退到普通 fs.writeFileSync
    const originalWrite = (s as any)._write.bind(s)
    ;(s as any)._write = function (value: unknown) {
      try {
        originalWrite(value)
      } catch (error: any) {
        const recoverableCodes = new Set(['EXDEV', 'EPERM', 'EACCES', 'EBUSY'])
        if (error && recoverableCodes.has(error.code)) {
          // 回退到非原子写入
          try {
            const data = (s as any)._serialize(value)
            fs.writeFileSync((s as any).path, data, { mode: 0o666 })
            return
          } catch (fallbackErr) {
            // 回退也失败，抛出原始错误由上层 try-catch 处理
            throw error
          }
        }
        throw error
      }
    }
  }
  return store as NonNullable<InstanceType<typeof ElectronStore>>
}

export function getStore(): NonNullable<InstanceType<typeof ElectronStore>> {
  if (!store) {
    return initStore()
  }
  return store as NonNullable<InstanceType<typeof ElectronStore>>
}

/**
 * 读取 monitor.defaultPollInterval,自动迁移旧默认值 30000 → 10000。
 *
 * conf 的 store getter 每次从磁盘读取,没有内存缓存,因此 s.set() 写入失败后
 * s.get() 仍返回磁盘旧值。此函数在应用层处理迁移,不依赖 store 写入。
 * 当用户下次保存设置时,正确的值会被持久化到磁盘。
 */
export function getEffectivePollInterval(): number {
  const store = getStore()
  const stored = store.get('monitor.defaultPollInterval') as number | undefined
  if (stored === 30000) {
    return 10000
  }
  return stored ?? 10000
}
