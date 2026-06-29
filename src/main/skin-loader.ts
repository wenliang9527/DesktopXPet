import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { createLogger } from './utils/logger'
import { ensureDir } from './utils/fs'
const log = createLogger('SkinLoader')
import type { SkinInfo, SkinManifest } from '@shared/types'
import { validateSkinManifestWithErrors } from '@shared/skin-schema'

/**
 * SkinLoader — 统一皮肤加载器
 * 从指定目录扫描皮肤包，解析 manifest.json，加载精灵图
 */
export class SkinLoader {
  private skinDirs: string[] = []
  // key 为 dirName (path.basename(skinDir))，避免不同目录下 manifest.name 相同时互相覆盖
  private loadedSkins: Map<string, { manifest: SkinManifest; dir: string }> = new Map()

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
   *
   * key 策略：以 dirName (目录名) 作为 loadedSkins 的 Map key，
   * 这样即使两个不同目录下的 manifest.name 相同也不会互相覆盖。
   * 同时检测 manifest.name 冲突并打印告警（仍保留两个皮肤）。
   */
  async scan(): Promise<SkinInfo[]> {
    // 确保用户皮肤目录存在（打包后可写目录）
    const userSkinDir = join(app.getPath('userData'), 'skins')
    await ensureDir(userSkinDir)

    this.loadedSkins.clear()
    const skins: SkinInfo[] = []
    // 用于检测 manifest.name 冲突: name -> 已记录的目录绝对路径列表
    const nameToDirs: Map<string, string[]> = new Map()

    for (const dir of this.skinDirs) {
      // 异步校验目录存在且是目录
      try {
        const dirStat = await fs.promises.stat(dir)
        if (!dirStat.isDirectory()) continue
      } catch {
        // 目录不存在或不可访问，跳过
        continue
      }

      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          const skinDir = join(dir, entry.name)
          const dirName = entry.name
          const manifestPath = join(skinDir, 'manifest.json')

          // 异步校验 manifest.json 存在且是文件
          try {
            const manifestStat = await fs.promises.stat(manifestPath)
            if (!manifestStat.isFile()) continue
          } catch {
            // manifest.json 不存在，跳过
            continue
          }

          try {
            const raw: unknown = JSON.parse(await fs.promises.readFile(manifestPath, 'utf-8'))
            // 使用 zod schema 校验 manifest,防止字段缺失/类型错误导致运行时崩溃
            const validation = validateSkinManifestWithErrors(raw)
            if ('errors' in validation) {
              log.warn(
                `Invalid skin manifest at ${skinDir}: ${validation.errors.join('; ')}`
              )
              continue
            }
            const manifest: SkinManifest = validation.data

            // 检测 manifest.name 冲突（不同目录的 manifest.name 相同）
            const existingDirs = nameToDirs.get(manifest.name)
            if (existingDirs && existingDirs.length > 0) {
              log.warn(
                `Duplicate skin manifest.name "${manifest.name}" detected: ${skinDir} conflicts with ${existingDirs.join(', ')}`
              )
              existingDirs.push(skinDir)
            } else {
              nameToDirs.set(manifest.name, [skinDir])
            }

            // key 为 dirName，同名 manifest 也不会互相覆盖
            this.loadedSkins.set(dirName, { manifest, dir: skinDir })
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

    log.info(`SkinLoader scanned ${skins.length} skins from ${this.skinDirs.length} directories`)
    return skins
  }

  /**
   * 获取皮肤目录路径（按 dirName 匹配）
   */
  getSkinDir(dirName: string): string | undefined {
    return this.loadedSkins.get(dirName)?.dir
  }

  /**
   * 获取所有皮肤信息（含路径）
   *
   * 每项包含: name(manifest.name), dirName(目录名), path(绝对路径), manifest
   * 直接从 loadedSkins 遍历，即使 manifest.name 重复也不会丢失条目
   */
  getSkinList(): Array<{ name: string; dirName: string; path: string; manifest: SkinManifest }> {
    const result: Array<{ name: string; dirName: string; path: string; manifest: SkinManifest }> =
      []
    for (const [dirName, data] of this.loadedSkins) {
      result.push({
        name: data.manifest.name,
        dirName,
        path: data.dir,
        manifest: data.manifest,
      })
    }
    return result
  }

  /**
   * 获取当前等级已解锁的皮肤列表
   * 过滤 manifest.unlockLevel <= level 的皮肤(默认 unlockLevel=1,向后兼容)
   * 用于 SKIN_LIST handler:渲染进程只能看到已解锁的皮肤
   */
  getUnlockedSkins(
    level: number
  ): Array<{ name: string; dirName: string; path: string; manifest: SkinManifest }> {
    return this.getSkinList().filter((s) => (s.manifest.unlockLevel ?? 1) <= level)
  }

  /**
   * 获取下一个皮肤 dirName（用于快速切换）
   * 通过 dirName 匹配，与 store 中存储的值一致
   */
  getNextSkin(currentDirName: string): string {
    const dirNames = Array.from(this.loadedSkins.keys())
    if (dirNames.length === 0) return currentDirName
    const idx = dirNames.indexOf(currentDirName)
    return dirNames[(idx + 1) % dirNames.length]
  }

  /**
   * 获取下一个已解锁皮肤的 dirName(用于托盘/快捷键快速切换)
   * 只在 unlockLevel <= level 的皮肤中循环,避免跳到未解锁皮肤(如婚纱)
   * 如果当前皮肤未解锁(等级回退等边缘情况),从已解锁列表第一个开始
   */
  getNextUnlockedSkin(currentDirName: string, level: number): string {
    const unlockedDirNames = this.getUnlockedSkins(level).map((s) => s.dirName)
    if (unlockedDirNames.length === 0) return currentDirName
    const idx = unlockedDirNames.indexOf(currentDirName)
    if (idx === -1) return unlockedDirNames[0]
    return unlockedDirNames[(idx + 1) % unlockedDirNames.length]
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
