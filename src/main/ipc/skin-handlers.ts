import { app, ipcMain, BrowserWindow, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { createLogger } from '../utils/logger'
const log = createLogger('IPC')
import { storeGet, storeSet } from '../store'
import { setSkinSoundDir } from '../sound'
import { installSkinPackage } from '../skin-installer'
import { IPC } from '../../shared/ipc-channels'
import { BUILTIN_SKINS } from '../../shared/skins'
import { container } from '../container'
import { withTimeout } from '../utils/ipc'

/**
 * 注册皮肤相关 IPC 处理器
 */
export function registerSkinHandlers(): void {
  ipcMain.handle(IPC.SKIN_READ_IMAGE, async (_, imagePath: string) => {
    const result = await withTimeout(async () => {
      const resolvedPath = path.resolve(imagePath)
      if (!resolvedPath.endsWith('.png') && !resolvedPath.endsWith('.json')) {
        return null
      }

      // 安全校验:只允许读取皮肤目录内的文件,防止路径遍历读取任意文件
      const allowedDirs = [
        path.resolve(path.join(app.getAppPath(), 'resources', 'skins')),
        path.resolve(path.join(app.getPath('userData'), 'skins')),
        ...(storeGet('skin.customSkinDirs') || []).map((d) =>
          path.resolve(d)
        ),
      ]
      const isAllowed = allowedDirs.some((d) => {
        const rel = path.relative(d, resolvedPath)
        return rel && !rel.startsWith('..') && !path.isAbsolute(rel)
      })
      if (!isAllowed) {
        log.warn('Skin file access denied (outside skin directories):', resolvedPath)
        return null
      }

      if (!fs.existsSync(resolvedPath)) {
        log.warn('Skin file not found:', resolvedPath)
        return null
      }
      const buffer = fs.readFileSync(resolvedPath)
      const ext = resolvedPath.endsWith('.json') ? 'application/json' : 'image/png'
      return `data:${ext};base64,${buffer.toString('base64')}`
    }, 3000)
    if (!result.success) {
      log.warn('Failed to read skin image:', result.error)
      return null
    }
    return result.data
  })

  ipcMain.handle(IPC.SKIN_LIST, async () => {
    const skinLoader = container.get('skinLoader')
    if (skinLoader) {
      // 根据当前养成等级过滤未解锁的皮肤,渲染进程只能看到已解锁的皮肤
      const level = container.get('nurtureService')?.getState()?.growth.level ?? 1
      return skinLoader.getUnlockedSkins(level).map((s) => ({
        ...s,
        dirName: path.basename(s.path),
      }))
    }
    return BUILTIN_SKINS.map((name) => ({
      name,
      dirName: name,
      path: path.join(app.getAppPath(), 'resources', 'skins', name),
    }))
  })

  ipcMain.handle(IPC.SKIN_SWITCH, async (_, name: string) => {
    const skinLoader = container.get('skinLoader')
    const skinList = skinLoader?.getSkinList() || []
    // 兼容传入 manifest.name(如"默认猫咪")或 dirName(如"default-cat")
    const skinEntry = skinList.find((s) => s.dirName === name || s.name === name)

    // 解锁校验:未达到 unlockLevel 的皮肤不允许切换
    if (skinEntry) {
      const currentLevel = container.get('nurtureService')?.getState()?.growth.level ?? 1
      const unlockLevel = skinEntry.manifest.unlockLevel ?? 1
      if (unlockLevel > currentLevel) {
        log.warn(
          `Skin switch blocked: "${name}" requires level ${unlockLevel}, current level ${currentLevel}`
        )
        return
      }
    }

    try {
      storeSet('skin.current', name)
    } catch (err) {
      log.warn('Failed to persist skin to store:', err)
    }
    const win = container.get('petWindow')?.getWin()
    if (win) {
      win.webContents.send(IPC.SKIN_CHANGED, name)
    }
    // 切换皮肤音效
    if (skinEntry) {
      await setSkinSoundDir(skinEntry.path)
      // 联动养成系统:注入新皮肤的 states 配置
      const nurtureService = container.get('nurtureService')
      if (nurtureService) {
        nurtureService.setSkinStates(skinEntry.manifest.states)
        // 切换皮肤后立即重新计算并广播显示状态
        nurtureService.computeAndBroadcastDisplayState()
      }
    }
    log.info(`Skin switched via IPC: ${name}`)
  })

  // 重新扫描皮肤目录(用户添加/删除皮肤后调用)
  ipcMain.handle(IPC.SKIN_RESCAN, async () => {
    const skinLoader = container.get('skinLoader')
    if (!skinLoader) return []
    const skins = await skinLoader.rescan()
    log.info(`Skins rescanned: ${skins.length} skins found`)
    // 广播皮肤列表变更,通知 SkinSelector 等组件重新加载
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) w.webContents.send(IPC.SKINS_RESCANNED)
    })
    return skins
  })

  // 打开用户皮肤目录(资源管理器)
  ipcMain.handle(IPC.SKIN_OPEN_USER_DIR, async () => {
    const skinLoader = container.get('skinLoader')
    const dir = skinLoader?.getUserSkinDir()
    if (dir) {
      shell.openPath(dir)
      log.info(`Opened skin directory: ${dir}`)
    }
  })

  // 安装 .xpet 皮肤包(拖拽安装)
  ipcMain.handle(
    IPC.SKIN_INSTALL_PACKAGE,
    async (_, xpetFilePath: string): Promise<{ success: boolean; skinName?: string; error?: string }> => {
      const result = await installSkinPackage(xpetFilePath)
      if (result.success) {
        // 安装成功后重新扫描皮肤目录
        const skinLoader = container.get('skinLoader')
        if (skinLoader) {
          await skinLoader.rescan()
          // 广播皮肤列表变更
          BrowserWindow.getAllWindows().forEach((w) => {
            if (!w.isDestroyed()) w.webContents.send(IPC.SKINS_RESCANNED)
          })
        }
        log.info(`Skin package installed: ${result.skinName}`)
      } else {
        log.warn(`Skin package install failed: ${result.error}`)
      }
      return { success: result.success, skinName: result.skinName, error: result.error }
    }
  )

  // 添加自定义皮肤源目录
  // 校验路径存在且是目录,规范化后写入 store.customSkinDirs,并触发 rescan + 广播
  ipcMain.handle(IPC.SKIN_ADD_DIR, async (_, dir: string): Promise<boolean> => {
    try {
      const resolved = path.resolve(dir)
      const stat = await fs.promises.stat(resolved)
      if (!stat.isDirectory()) {
        log.warn(`SKIN_ADD_DIR: not a directory: ${resolved}`)
        return false
      }
      const customDirs = storeGet('skin.customSkinDirs') || []
      if (customDirs.includes(resolved)) {
        log.info(`SKIN_ADD_DIR: already registered: ${resolved}`)
        return false
      }
      storeSet('skin.customSkinDirs', [...customDirs, resolved])
      const skinLoader = container.get('skinLoader')
      if (skinLoader) {
        skinLoader.addDirectory(resolved)
        await skinLoader.rescan()
        BrowserWindow.getAllWindows().forEach((w) => {
          if (!w.isDestroyed()) w.webContents.send(IPC.SKINS_RESCANNED)
        })
      }
      log.info(`SKIN_ADD_DIR: added: ${resolved}`)
      return true
    } catch (err) {
      log.warn('SKIN_ADD_DIR failed:', err)
      return false
    }
  })

  // 移除自定义皮肤源目录
  // 仅从 store.customSkinDirs 移除(SkinLoader 无 removeDirectory 方法,下次重启生效)
  ipcMain.handle(IPC.SKIN_REMOVE_DIR, async (_, dir: string): Promise<boolean> => {
    try {
      const resolved = path.resolve(dir)
      const customDirs = storeGet('skin.customSkinDirs') || []
      const newDirs = customDirs.filter((d) => d !== resolved)
      if (newDirs.length === customDirs.length) {
        log.info(`SKIN_REMOVE_DIR: not registered: ${resolved}`)
        return false
      }
      storeSet('skin.customSkinDirs', newDirs)
      log.info(`SKIN_REMOVE_DIR: removed: ${resolved}`)
      return true
    } catch (err) {
      log.warn('SKIN_REMOVE_DIR failed:', err)
      return false
    }
  })

  // 列出已注册的自定义皮肤源目录
  ipcMain.handle(IPC.SKIN_LIST_DIRS, async (): Promise<string[]> => {
    return storeGet('skin.customSkinDirs') || []
  })
}
