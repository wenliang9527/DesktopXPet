import { safeStorage } from 'electron'
import { getStore } from './store'
import { createLogger } from './utils/logger'

const log = createLogger('SecureStore')

/**
 * 安全存储 — 利用系统级密钥链加密敏感数据
 *
 * 底层使用 electron.safeStorage API:
 * - Windows: DPAPI
 * - macOS: Keychain
 * - Linux: libsecret/kwallet
 *
 * 加密后的值存储在 electron-store 中，key 加 `:encrypted` 后缀，
 * 原始明文 key 在迁移后会被删除。
 */

/** 加密存储前缀 */
const ENCRYPTED_SUFFIX = ':encrypted'

/**
 * 判断 safeStorage 是否可用（Linux 上可能未安装 libsecret）
 */
export function isSafeStorageAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

/**
 * 加密存储敏感值
 * - 如果 safeStorage 可用，加密后存到 store 的 `key:encrypted` 字段，并删除明文 `key`
 * - 如果不可用，回退到明文存储（Linux 无 keyring 场景）
 */
export function setSecret(key: string, value: string): void {
  const store = getStore()

  if (isSafeStorageAvailable()) {
    try {
      const encrypted = safeStorage.encryptString(value)
      // 以 base64 存储加密 buffer
      store.set(key + ENCRYPTED_SUFFIX, encrypted.toString('base64'))
      // 删除可能残留的明文
      if (store.has(key)) {
        store.delete(key)
      }
      return
    } catch (err) {
      log.warn(`Failed to encrypt secret "${key}", falling back to plaintext:`, err)
    }
  }

  // 回退：明文存储
  store.set(key, value)
}

/**
 * 读取敏感值
 * - 优先读取 `key:encrypted` 并解密
 * - 回退到明文 `key`（兼容迁移前数据）
 * - 解密失败时回退到明文
 */
export function getSecret(key: string): string | undefined {
  const store = getStore()
  const encryptedKey = key + ENCRYPTED_SUFFIX

  // 优先读取加密版本
  if (store.has(encryptedKey)) {
    const encoded = store.get(encryptedKey) as string
    if (isSafeStorageAvailable()) {
      try {
        const buffer = Buffer.from(encoded, 'base64')
        return safeStorage.decryptString(buffer)
      } catch (err) {
        log.warn(`Failed to decrypt secret "${key}", trying plaintext:`, err)
      }
    }
  }

  // 回退：明文读取（兼容旧数据或 Linux 无 keyring）
  if (store.has(key)) {
    return store.get(key) as string
  }

  return undefined
}

/**
 * 删除敏感值（同时删除加密版本和明文版本）
 */
export function deleteSecret(key: string): void {
  const store = getStore()
  store.delete(key)
  store.delete(key + ENCRYPTED_SUFFIX)
}

/**
 * 迁移已有的明文敏感数据到加密存储
 * 在应用启动时调用
 */
export function migratePlaintextSecrets(): void {
  const secrets = ['apiToken', 'monitor.plugins.github.config.token']

  for (const key of secrets) {
    const store = getStore()
    const encryptedKey = key + ENCRYPTED_SUFFIX

    // 已有加密版本，跳过
    if (store.has(encryptedKey)) continue
    // 没有明文版本，跳过
    if (!store.has(key)) continue

    const plaintext = store.get(key) as string
    if (!plaintext) continue

    if (isSafeStorageAvailable()) {
      try {
        const encrypted = safeStorage.encryptString(plaintext)
        store.set(encryptedKey, encrypted.toString('base64'))
        store.delete(key)
        log.info(`Migrated secret "${key}" to encrypted storage`)
      } catch (err) {
        log.warn(`Failed to migrate secret "${key}" to encrypted storage:`, err)
      }
    } else {
      log.info(`safeStorage unavailable, keeping "${key}" as plaintext`)
    }
  }
}
