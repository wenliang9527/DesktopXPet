import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import log from 'electron-log/main'

let soundEnabled = true
const soundPaths: Map<string, string> = new Map()

// 支持的音效文件扩展名
const SOUND_EXTENSIONS = ['.wav', '.mp3']

/**
 * 确保目录存在（带重试，应对 Windows 上杀毒软件/文件锁定的临时 EPERM）
 * 异步实现，避免 busy wait 阻塞主进程
 */
async function ensureDir(dir: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      return
    } catch (err: any) {
      if (err?.code === 'EPERM' || err?.code === 'EACCES') {
        // 权限错误，等待后重试（杀毒软件扫描/文件锁定通常是临时的）
        if (attempt < 2) {
          // 异步等待 100ms，不阻塞主进程
          await new Promise((resolve) => setTimeout(resolve, 100))
          continue
        }
      }
      log.warn(`Failed to create directory ${dir} after ${attempt + 1} attempts:`, err)
      return
    }
  }
}

/**
 * 扫描目录下的所有音效文件，注册到 soundPaths
 * 后扫描的目录会覆盖先扫描的（实现用户目录优先于内置目录）
 */
function scanSoundDir(dir: string): number {
  let count = 0
  if (!fs.existsSync(dir)) return 0

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const ext = entry.name.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
      if (!SOUND_EXTENSIONS.includes(ext)) continue

      // 文件名（不含扩展名）作为 key，如 click.wav → click
      // 用正则去除扩展名，兼容大写扩展名（如 click.WAV）
      const name = entry.name.replace(/\.[^.]+$/i, '')
      const fullPath = join(dir, entry.name)
      soundPaths.set(name, fullPath)
      count++
    }
  } catch (err) {
    log.warn(`Failed to scan sound directory ${dir}:`, err)
  }
  return count
}

export async function initSound(): Promise<void> {
  soundPaths.clear()

  // 1. 先加载内置音效目录（resources/sounds）— 打包后只读
  const builtinSoundDir = join(app.getAppPath(), 'resources', 'sounds')
  const builtinCount = scanSoundDir(builtinSoundDir)

  // 2. 再加载用户音效目录（userData/sounds）— 可写，同名文件覆盖内置
  // 打包后 resources/ 在 app.asar 内只读，用户无法添加/替换音效
  // userData/sounds 是用户可写目录，用户可将音效文件放入此处
  const userSoundDir = join(app.getPath('userData'), 'sounds')
  await ensureDir(userSoundDir)
  const userCount = scanSoundDir(userSoundDir)

  log.info(
    `Sound system initialized: ${soundPaths.size} sounds loaded (builtin: ${builtinCount}, user: ${userCount})`
  )
}

/**
 * 重新加载音效（用户添加/替换音效后调用）
 */
export async function reloadSound(): Promise<void> {
  await initSound()
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled
}

export function isSoundEnabled(): boolean {
  return soundEnabled
}

export function getSoundPath(name: string): string | undefined {
  if (!soundEnabled) return undefined
  return soundPaths.get(name)
}

/**
 * 获取用户音效目录路径（用于在 UI 中打开）
 */
export function getUserSoundDir(): string {
  return join(app.getPath('userData'), 'sounds')
}

/**
 * 列出所有已加载的音效文件名
 */
export function listSounds(): string[] {
  return Array.from(soundPaths.keys())
}
