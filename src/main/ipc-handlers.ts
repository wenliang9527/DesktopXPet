import { app, ipcMain, Menu, BrowserWindow, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { createLogger } from './utils/logger'
const log = createLogger('IPC')
import { getStore } from './store'
import { getSoundPath, reloadSound, getUserSoundDir, setSoundEnabled } from './sound'
import { installSkinPackage } from './skin-installer'
import { IPC } from '../shared/ipc-channels'
import { DASHBOARD_WIDTH, DASHBOARD_HEIGHT } from '../shared/constants'
import { BUILTIN_SKINS } from '../shared/skins'
import { container } from './container'
import { withTimeout } from './utils/ipc'

let currentSkinIndex = 0

/**
 * 打开仪表盘窗口(单例:已存在则聚焦)
 */
export function openDashboard(): void {
  const petWindow = container.get('petWindow')
  const existingDashboard = BrowserWindow.getAllWindows().find(
    (w) => w !== petWindow?.getWin() && !w.isDestroyed()
  )
  if (existingDashboard) {
    existingDashboard.focus()
    return
  }

  const dashboardWin = new BrowserWindow({
    width: DASHBOARD_WIDTH,
    height: DASHBOARD_HEIGHT,
    title: 'DesktopXPet 仪表盘',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    dashboardWin.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/dashboard`)
  } else {
    dashboardWin.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: '/dashboard',
    })
  }

  log.info('Dashboard window opened')
}

/**
 * 切换到下一个皮肤(用于托盘/快捷键)
 */
export function cycleNextSkin(): void {
  const petWindow = container.get('petWindow')
  const skinLoader = container.get('skinLoader')
  const store = getStore()

  let nextSkin: string
  if (skinLoader && skinLoader.getSkinList().length > 0) {
    const currentSkin = (store.get('skin.current') as string) || BUILTIN_SKINS[0]
    nextSkin = skinLoader.getNextSkin(currentSkin)
  } else {
    currentSkinIndex = (currentSkinIndex + 1) % BUILTIN_SKINS.length
    nextSkin = BUILTIN_SKINS[currentSkinIndex]
  }

  try {
    store.set('skin.current', nextSkin)
  } catch (err) {
    log.warn('Failed to persist skin to store:', err)
  }
  log.info(`Skin switched to: ${nextSkin}`)

  const win = petWindow?.getWin()
  if (win) {
    win.webContents.send('skin:changed', nextSkin)
  }
}

/**
 * 注册所有 IPC 处理器
 */
export function setupIPC(): void {
  // ===== 宠物窗口 =====
  ipcMain.handle(IPC.PET_SET_POSITION, async (_, { x, y }) => {
    container.get('petWindow')?.setPosition(x, y)
  })

  ipcMain.handle(IPC.PET_GET_POSITION, async () => {
    const win = container.get('petWindow')?.getWin()
    if (!win) return null
    const bounds = win.getBounds()
    return { x: bounds.x, y: bounds.y }
  })

  ipcMain.handle(IPC.PET_SHOW_CONTEXT_MENU, async () => {
    const petWindow = container.get('petWindow')
    const win = petWindow?.getWin()
    if (!win) return

    const skins = container.get('skinLoader')?.getSkinList() || []
    log.info(`Building context menu with ${skins.length} skins`)

    const skinSubmenu = skins.map((skin) => ({
      label: skin.name,
      click: () => {
        log.info(`Switching skin to: ${skin.name} (dirName: ${skin.dirName})`)
        // 先发送切换事件(即使 store 写入失败也要切换)
        const windows = BrowserWindow.getAllWindows()
        windows.forEach((w) => {
          if (!w.isDestroyed()) {
            w.webContents.send('skin:changed', skin.dirName)
          }
        })
        // 异步持久化到 store(失败不影响切换)
        try {
          const store = getStore()
          store.set('skin.current', skin.dirName)
        } catch (err) {
          log.warn('Failed to persist skin to store:', err)
        }
      },
    }))

    const menu = Menu.buildFromTemplate([
      {
        label: '📊 打开仪表盘',
        click: () => openDashboard(),
      },
      { type: 'separator' },
      {
        label: '🎨 切换皮肤',
        submenu: skinSubmenu,
      },
      {
        label: '📁 打开皮肤目录',
        click: () => {
          const skinLoader = container.get('skinLoader')
          const dir = skinLoader?.getUserSkinDir()
          if (dir) shell.openPath(dir)
        },
      },
      {
        label: '🎵 打开音效目录',
        click: () => {
          shell.openPath(getUserSoundDir())
        },
      },
      {
        label: '🔄 刷新皮肤列表',
        click: async () => {
          const skinLoader = container.get('skinLoader')
          if (skinLoader) {
            await skinLoader.rescan()
            // 广播皮肤列表变更,通知 SkinSelector 等组件重新加载
            BrowserWindow.getAllWindows().forEach((w) => {
              if (!w.isDestroyed()) w.webContents.send('skins:rescanned')
            })
            log.info('Skin list refreshed from context menu')
          }
        },
      },
      {
        label: '⚙️ 设置',
        click: () => openDashboard(),
      },
      { type: 'separator' },
      {
        label: '📌 置顶',
        type: 'checkbox',
        checked: true,
        click: (item) => petWindow?.toggleAlwaysOnTop(item.checked),
      },
      { type: 'separator' },
      {
        label: '🔄 重置位置',
        click: () => petWindow?.resetPosition(),
      },
      {
        label: '️ 显示/隐藏',
        click: () => petWindow?.toggleVisibility(),
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => app.quit(),
      },
    ])

    menu.popup({ window: win })
  })

  // ===== 皮肤 =====
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
        ...((getStore().get('skin.customSkinDirs') as string[]) || []).map((d) =>
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
      return skinLoader.getSkinList().map((s) => ({
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
    const store = getStore()
    try {
      store.set('skin.current', name)
    } catch (err) {
      log.warn('Failed to persist skin to store:', err)
    }
    const win = container.get('petWindow')?.getWin()
    if (win) {
      win.webContents.send('skin:changed', name)
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
      if (!w.isDestroyed()) w.webContents.send('skins:rescanned')
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
            if (!w.isDestroyed()) w.webContents.send('skins:rescanned')
          })
        }
        log.info(`Skin package installed: ${result.skinName}`)
      } else {
        log.warn(`Skin package install failed: ${result.error}`)
      }
      return { success: result.success, skinName: result.skinName, error: result.error }
    }
  )

  // ===== 应用设置 =====
  ipcMain.handle(IPC.APP_GET_STORE, async () => {
    const store = getStore().store
    // 过滤敏感字段,避免 API token 泄露到渲染进程
    const { apiToken, ...safeStore } = store as Record<string, unknown>
    return safeStore
  })

  ipcMain.handle(IPC.APP_SET_STORE, async (_, settings) => {
    const store = getStore()
    for (const [key, value] of Object.entries(settings)) {
      try {
        store.set(key, value)
      } catch (err) {
        log.warn(`Failed to persist setting ${key} to store:`, err)
      }
    }

    if ('general.autoStart' in settings) {
      app.setLoginItemSettings({
        openAtLogin: settings['general.autoStart'] === true,
        openAsHidden: true,
      })
    }

    // 点击音效设置生效
    if ('pet.clickSound' in settings) {
      setSoundEnabled(settings['pet.clickSound'] === true)
    }

    log.info('Settings updated:', Object.keys(settings).join(', '))
  })

  ipcMain.handle(IPC.APP_QUIT, async () => {
    app.quit()
  })

  ipcMain.handle(IPC.APP_OPEN_DASHBOARD, async () => {
    openDashboard()
  })

  ipcMain.handle(IPC.APP_GET_PET_NAME, async () => {
    try {
      return getStore().get('general.petName') || 'DesktopXPet'
    } catch {
      return 'DesktopXPet'
    }
  })

  ipcMain.handle(IPC.APP_SET_PET_NAME, async (_, name: string) => {
    try {
      getStore().set('general.petName', name)
      // 通知所有渲染进程名称已更新
      BrowserWindow.getAllWindows().forEach((w) => {
        if (!w.isDestroyed()) w.webContents.send('pet-name:changed', name)
      })
    } catch (err) {
      log.warn('Failed to persist pet name:', err)
    }
  })

  // ===== 监控 =====
  ipcMain.handle(IPC.MONITOR_GET_SNAPSHOT, async () => {
    return (
      container.get('monitorService')?.getSnapshot() || {
        petState: 'idle',
        tools: [],
        summary: 'DesktopXPet 待机中',
      }
    )
  })

  // ===== 插件 =====
  ipcMain.handle(IPC.PLUGIN_LIST, async () => {
    return container.get('pluginRegistry')?.getPluginInfos() || []
  })

  ipcMain.handle(IPC.PLUGIN_TOGGLE, async (_, { name, enabled }) => {
    container.get('pluginRegistry')?.togglePlugin(name, enabled)
  })

  // ===== 音效 =====
  // 重新加载音效(用户添加/替换音效后调用)
  ipcMain.handle(IPC.SOUND_RELOAD, async () => {
    await reloadSound()
    log.info('Sounds reloaded')
  })

  // 打开用户音效目录(资源管理器)
  ipcMain.handle(IPC.SOUND_OPEN_USER_DIR, async () => {
    const dir = getUserSoundDir()
    shell.openPath(dir)
    log.info(`Opened sound directory: ${dir}`)
  })

  ipcMain.on(IPC.SOUND_PLAY, (event, name: string) => {
    const soundPath = getSoundPath(name)
    if (soundPath) {
      event.sender.send('sound:play-file', soundPath)
    }
  })
}
