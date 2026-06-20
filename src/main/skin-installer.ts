import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import AdmZip from 'adm-zip'
import { createLogger } from './utils/logger'
import { validateSkinManifestWithErrors } from '@shared/skin-schema'

const log = createLogger('SkinInstaller')

// 安全限制:防止恶意 .xpet 包
const MAX_ENTRIES = 500 // 最大文件数
const MAX_TOTAL_SIZE = 100 * 1024 * 1024 // 100MB 总大小限制

export interface InstallResult {
  success: boolean
  skinName?: string
  dirName?: string
  error?: string
}

/**
 * 安装 .xpet 皮肤包
 * .xpet 本质是 zip 文件,解压到 userData/skins/<dirName>/
 *
 * 安全措施:
 * 1. 校验 zip 条目数和总大小
 * 2. 防止 zip slip(路径遍历)攻击
 * 3. 校验 manifest.json 存在且符合 schema
 *
 * @param xpetFilePath .xpet 文件的绝对路径
 */
export async function installSkinPackage(xpetFilePath: string): Promise<InstallResult> {
  try {
    // 1. 校验文件存在且是 .xpet 扩展名
    if (!fs.existsSync(xpetFilePath)) {
      return { success: false, error: '文件不存在' }
    }
    if (!xpetFilePath.toLowerCase().endsWith('.xpet')) {
      return { success: false, error: '文件格式不支持(仅支持 .xpet)' }
    }

    log.info(`Installing skin package: ${xpetFilePath}`)

    // 2. 打开 zip
    const zip = new AdmZip(xpetFilePath)
    const entries = zip.getEntries()

    if (entries.length === 0) {
      return { success: false, error: '皮肤包为空' }
    }
    if (entries.length > MAX_ENTRIES) {
      return { success: false, error: `皮肤包文件数超过限制(${MAX_ENTRIES})` }
    }

    // 3. 计算总大小并检测 zip slip
    let totalSize = 0
    const userSkinDir = join(app.getPath('userData'), 'skins')
    const resolvedUserSkinDir = fs.realpathSync(userSkinDir)

    for (const entry of entries) {
      totalSize += entry.header.size
      if (totalSize > MAX_TOTAL_SIZE) {
        return { success: false, error: '皮肤包总大小超过限制(100MB)' }
      }

      // 防止 zip slip:解压路径必须在 userSkinDir 内
      const targetPath = join(userSkinDir, entry.entryName)
      const resolvedTarget = join(resolvedUserSkinDir, entry.entryName)
      if (!resolvedTarget.startsWith(resolvedUserSkinDir + '\\') && !resolvedTarget.startsWith(resolvedUserSkinDir + '/')) {
        return { success: false, error: '检测到非法路径(zip slip 攻击)' }
      }
      // 检查 targetPath 也没有越界
      if (!targetPath.startsWith(userSkinDir)) {
        return { success: false, error: '检测到非法路径' }
      }
    }

    // 4. 确定皮肤目录名
    // .xpet 文件名(不含扩展名)作为目录名,但如果 zip 内有顶层目录则使用顶层目录
    const baseName = xpetFilePath
      .replace(/[\\/]/g, '/')
      .split('/')
      .pop()!
      .replace(/\.xpet$/i, '')

    // 检测 zip 内是否有顶层目录
    const topLevelDirs = new Set(
      entries.map((e) => e.entryName.split('/')[0]).filter((name) => name && !name.includes('.'))
    )

    let skinDirName: string
    let extractBase: string

    if (topLevelDirs.size === 1) {
      // zip 内有单一顶层目录,直接解压到 userSkinDir
      skinDirName = Array.from(topLevelDirs)[0]
      extractBase = userSkinDir
    } else {
      // zip 内没有顶层目录(散文件)或多个目录,创建以文件名命名的子目录
      skinDirName = baseName
      extractBase = join(userSkinDir, baseName)
      // 如果目录已存在,先删除(覆盖安装)
      if (fs.existsSync(extractBase)) {
        fs.rmSync(extractBase, { recursive: true, force: true })
      }
      fs.mkdirSync(extractBase, { recursive: true })
    }

    // 5. 解压
    zip.extractAllTo(extractBase, true)
    log.info(`Skin extracted to: ${join(extractBase, skinDirName)}`)

    // 6. 校验 manifest.json
    const skinDir = join(extractBase, skinDirName)
    const manifestPath = join(skinDir, 'manifest.json')
    if (!fs.existsSync(manifestPath)) {
      // 清理:删除解压的目录
      fs.rmSync(skinDir, { recursive: true, force: true })
      return { success: false, error: '皮肤包缺少 manifest.json' }
    }

    try {
      const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
      const validation = validateSkinManifestWithErrors(raw)
      if ('errors' in validation) {
        fs.rmSync(skinDir, { recursive: true, force: true })
        return {
          success: false,
          error: `manifest.json 校验失败: ${validation.errors.join('; ')}`,
        }
      }
      const skinName = validation.data.name
      log.info(`Skin "${skinName}" installed successfully to ${skinDir}`)
      return { success: true, skinName, dirName: skinDirName }
    } catch (err) {
      fs.rmSync(skinDir, { recursive: true, force: true })
      return { success: false, error: `manifest.json 解析失败: ${err}` }
    }
  } catch (err) {
    log.error('Failed to install skin package:', err)
    return { success: false, error: `安装失败: ${err}` }
  }
}
