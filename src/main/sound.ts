import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import log from 'electron-log/main'

let soundEnabled = true
const soundPaths: Map<string, string> = new Map()
// 缓存音效的 data URL (base64),避免每次播放都读磁盘
const soundDataUrls: Map<string, string> = new Map()

// 当前皮肤的音效目录（皮肤切换时更新）
let currentSkinSoundDir: string | null = null

// 支持的音效文件扩展名及对应 MIME 类型
const SOUND_EXTENSIONS: Record<string, string> = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
}

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
 * 扫描目录下的所有音效文件，注册到 soundPaths / soundDataUrls
 * 后扫描的目录会覆盖先扫描的（实现高优先级覆盖低优先级）
 */
function scanSoundDir(dir: string): number {
  let count = 0
  if (!fs.existsSync(dir)) return 0

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const ext = entry.name.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
      if (!(ext in SOUND_EXTENSIONS)) continue

      // 文件名（不含扩展名）作为 key，如 click.wav → click
      const name = entry.name.replace(/\.[^.]+$/i, '')
      const fullPath = join(dir, entry.name)
      soundPaths.set(name, fullPath)

      // 预加载为 data URL,供 sandbox 渲染进程播放
      try {
        const data = fs.readFileSync(fullPath)
        const mime = SOUND_EXTENSIONS[ext]
        soundDataUrls.set(name, `data:${mime};base64,${data.toString('base64')}`)
      } catch (err) {
        log.warn(`Failed to preload sound ${name}:`, err)
      }

      count++
    }
  } catch (err) {
    log.warn(`Failed to scan sound directory ${dir}:`, err)
  }
  return count
}

/**
 * 初始化音效系统
 * 加载顺序: 内置音效 → 皮肤音效 → 用户音效（后者覆盖前者）
 */
export async function initSound(): Promise<void> {
  soundPaths.clear()
  soundDataUrls.clear()

  // 1. 先加载内置音效目录（resources/sounds）— 最低优先级
  const builtinSoundDir = join(app.getAppPath(), 'resources', 'sounds')
  const builtinCount = scanSoundDir(builtinSoundDir)

  // 2. 加载当前皮肤的音效目录（skin-dir/sounds/）— 中等优先级
  let skinCount = 0
  if (currentSkinSoundDir && fs.existsSync(currentSkinSoundDir)) {
    skinCount = scanSoundDir(currentSkinSoundDir)
  }

  // 3. 最后加载用户音效目录（userData/sounds）— 最高优先级
  // 打包后 resources/ 在 app.asar 内只读，用户无法添加/替换音效
  // userData/sounds 是用户可写目录，用户可将音效文件放入此处
  const userSoundDir = join(app.getPath('userData'), 'sounds')
  await ensureDir(userSoundDir)
  const userCount = scanSoundDir(userSoundDir)

  log.info(
    `Sound system initialized: ${soundPaths.size} sounds loaded (builtin: ${builtinCount}, skin: ${skinCount}, user: ${userCount})`
  )
}

/**
 * 设置当前皮肤的音效目录，并重新加载音效
 * 切换皮肤时调用
 */
export async function setSkinSoundDir(skinDir: string | null): Promise<void> {
  if (skinDir) {
    currentSkinSoundDir = join(skinDir, 'sounds')
  } else {
    currentSkinSoundDir = null
  }
  await initSound()
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
 * 获取音效的 data URL (base64),用于 sandbox 渲染进程播放。
 * sandbox 模式下 file:/// 协议被禁止,必须用 data URL。
 */
export function getSoundDataUrl(name: string): string | undefined {
  if (!soundEnabled) return undefined
  return soundDataUrls.get(name)
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
