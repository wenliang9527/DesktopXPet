import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { createLogger } from './utils/logger'
const log = createLogger('SkinLoader')
import type { SkinInfo, SkinManifest } from '@shared/types'
import { validateSkinManifestWithErrors } from '@shared/skin-schema'

/**
 * SkinLoader — 统一皮肤加载器
 * 从指定目录扫描皮肤包，解析 manifest.json，加载精灵图
 */
export class SkinLoader {
  private skinDirs: string[] = []
  private loadedSkins: Map<string, { manifest: SkinManifest; dir: string }> = new Map()
  private currentSkin: string = ''
  private scanCache: SkinInfo[] | null = null

  constructor() {
    const builtinSkinDir = join(app.getAppPath(), 'resources', 'skins')
    if (fs.existsSync(builtinSkinDir)) {
      this.skinDirs.push(builtinSkinDir)
    }

    // 用户皮肤目录（打包后可写）— userData/skins
    // 打包后 resources/ 在 app.asar 内只读，用户无法添加皮肤
    // userData/skins 是用户可写目录，用户可将皮肤文件夹放入此处
    // 目录的创建延迟到 scan() 中异步执行（避免 constructor 中同步阻塞）
    const userSkinDir = join(app.getPath('userData'), 'skins')
    this.skinDirs.push(userSkinDir)
  }

  /**
   * 确保目录存在（带重试，应对 Windows 上杀毒软件/文件锁定的临时 EPERM）
   * 异步实现，避免 busy wait 阻塞主进程
   */
  private async ensureDir(dir: string): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        return
      } catch (err: any) {
        if (err?.code === 'EPERM' || err?.code === 'EACCES') {
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
   * 获取用户皮肤目录路径（用于在 UI 中打开）
   */
  getUserSkinDir(): string {
    return join(app.getPath('userData'), 'skins')
  }

  /**
   * 添加皮肤源目录
   */
  addDirectory(dir: string): void {
    if (!this.skinDirs.includes(dir) && fs.existsSync(dir)) {
      this.skinDirs.push(dir)
    }
  }

  /**
   * 扫描所有目录，加载皮肤
   */
  async scan(): Promise<SkinInfo[]> {
    // 确保用户皮肤目录存在（打包后可写目录）
    const userSkinDir = join(app.getPath('userData'), 'skins')
    await this.ensureDir(userSkinDir)

    this.loadedSkins.clear()
    this.scanCache = null
    const skins: SkinInfo[] = []

    for (const dir of this.skinDirs) {
      if (!fs.existsSync(dir)) continue

      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          const skinDir = join(dir, entry.name)
          const manifestPath = join(skinDir, 'manifest.json')
          if (!fs.existsSync(manifestPath)) continue

          try {
            const raw: unknown = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
            // 使用 zod schema 校验 manifest,防止字段缺失/类型错误导致运行时崩溃
            const validation = validateSkinManifestWithErrors(raw)
            if ('errors' in validation) {
              log.warn(
                `Invalid skin manifest at ${skinDir}: ${validation.errors.join('; ')}`
              )
              continue
            }
            const manifest: SkinManifest = validation.data
            this.loadedSkins.set(manifest.name, { manifest, dir: skinDir })
            skins.push({
              name: manifest.name,
              author: manifest.author,
              preview: join(skinDir, manifest.preview || 'preview.png'),
            })
          } catch (err) {
            log.warn(`Failed to parse skin manifest at ${skinDir}:`, err)
          }
        }
      } catch (err) {
        log.warn(`Failed to scan skin directory ${dir}:`, err)
      }
    }

    this.scanCache = skins
    log.info(`SkinLoader scanned ${skins.length} skins from ${this.skinDirs.length} directories`)
    return skins
  }

  /**
   * 获取皮肤目录路径
   */
  getSkinDir(name: string): string | undefined {
    return this.loadedSkins.get(name)?.dir
  }

  /**
   * 获取所有皮肤信息（含路径）— 使用缓存
   */
  getSkinList(): Array<{ name: string; dirName: string; path: string; manifest: SkinManifest }> {
    if (this.scanCache !== null) {
      return this.scanCache.map((skin) => {
        const data = this.loadedSkins.get(skin.name)
        return {
          name: skin.name,
          dirName: data?.dir ? data.dir.split(/[\\/]/).pop() || '' : '',
          path: data?.dir || '',
          manifest: data?.manifest || ({} as SkinManifest),
        }
      })
    }

    const result: Array<{ name: string; dirName: string; path: string; manifest: SkinManifest }> =
      []
    for (const [, data] of this.loadedSkins) {
      result.push({
        name: data.manifest.name,
        dirName: data.dir.split(/[\\/]/).pop() || '',
        path: data.dir,
        manifest: data.manifest,
      })
    }
    return result
  }

  /**
   * 获取下一个皮肤 dirName（用于快速切换）
   * 通过 dirName 匹配，与 store 中存储的值一致
   */
  getNextSkin(currentDirName: string): string {
    const entries = Array.from(this.loadedSkins.values())
    if (entries.length === 0) return currentDirName
    const dirNames = entries.map((e) => e.dir.split(/[\\/]/).pop() || '')
    const idx = dirNames.indexOf(currentDirName)
    return dirNames[(idx + 1) % dirNames.length]
  }

  /**
   * 设置当前皮肤
   */
  setCurrentSkin(name: string): void {
    this.currentSkin = name
  }

  getCurrentSkin(): string {
    return this.currentSkin
  }

  /**
   * 清除缓存（当皮肤目录变更时调用）
   */
  clearCache(): void {
    this.scanCache = null
  }

  /**
   * 重新扫描皮肤目录（用户添加/删除皮肤后调用）
   * 返回最新的皮肤列表
   */
  async rescan(): Promise<SkinInfo[]> {
    log.info('Rescanning skin directories...')
    return this.scan()
  }
}
