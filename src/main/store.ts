import ElectronStore from 'electron-store'
import fs from 'fs'
import { DEFAULT_SETTINGS } from '@shared/constants'

// electron-store ESM default export 兼容处理
const Store = (ElectronStore as any).default || ElectronStore

let store: InstanceType<typeof ElectronStore> | null = null

export function initStore(): NonNullable<InstanceType<typeof ElectronStore>> {
  if (!store) {
    store = new Store({
      name: 'desktopxpet-config',
      defaults: DEFAULT_SETTINGS as any,
    })

    // 覆盖 _write 方法：扩展 atomically 失败时的回退逻辑
    // conf 原生只处理 EXDV 回退，Windows 上 EPERM（杀毒软件/文件锁定）也会导致原子写入失败
    // 这里扩展为：EXDEV、EPERM、EACCES 都回退到普通 fs.writeFileSync
    const originalWrite = (store as any)._write.bind(store)
    ;(store as any)._write = function (value: unknown) {
      try {
        originalWrite(value)
      } catch (error: any) {
        const recoverableCodes = new Set(['EXDEV', 'EPERM', 'EACCES', 'EBUSY'])
        if (error && recoverableCodes.has(error.code)) {
          // 回退到非原子写入
          try {
            const data = (store as any)._serialize(value)
            fs.writeFileSync((store as any).path, data, { mode: 0o666 })
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
