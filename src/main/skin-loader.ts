import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import log from 'electron-log/main'
import type { SkinInfo, SkinManifest } from '@shared/types'

/**
 * SkinLoader — 统一皮肤加载器
 * 从指定目录扫描皮肤包，解析 manifest.json，加载精灵图
 */
export class SkinLoader {
  private skinDirs: string[] = []
  private loadedSkins: Map<string, { manifest: SkinManifest; dir: string }> = new Map()
  private currentSkin: string = ''

  constructor() {
    // 添加内置皮肤目录
    const builtinSkinDir = join(app.getAppPath(), 'resources', 'skins')
    if (fs.existsSync(builtinSkinDir)) {
      this.skinDirs.push(builtinSkinDir)
    }
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
    this.loadedSkins.clear()
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
            const manifest: SkinManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
            this.loadedSkins.set(manifest.name, { manifest, dir: skinDir })
            skins.push({
              name: manifest.name,
              author: manifest.author,
              preview: join(skinDir, manifest.preview || 'preview.png')
            })
          } catch (err) {
            log.warn(`Failed to parse skin manifest at ${skinDir}:`, err)
          }
        }
      } catch (err) {
        log.warn(`Failed to scan skin directory ${dir}:`, err)
      }
    }

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
   * 获取所有皮肤信息（含路径）
   */
  getSkinList(): Array<{ name: string; path: string; manifest: SkinManifest }> {
    const result: Array<{ name: string; path: string; manifest: SkinManifest }> = []
    for (const [, data] of this.loadedSkins) {
      result.push({
        name: data.manifest.name,
        path: data.dir,
        manifest: data.manifest
      })
    }
    return result
  }

  /**
   * 获取下一个皮肤名称（用于快速切换）
   */
  getNextSkin(current: string): string {
    const names = Array.from(this.loadedSkins.keys())
    if (names.length === 0) return current
    const idx = names.indexOf(current)
    return names[(idx + 1) % names.length]
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
}
