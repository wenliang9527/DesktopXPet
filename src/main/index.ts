import { app, ipcMain, Menu, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import log from 'electron-log/main'
import { PetWindowManager } from './window'
import { initStore, getStore } from './store'
import { createTray, destroyTray, updateTrayTooltip } from './tray'
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from './shortcuts'
import { pushNotification } from './notify'
import { PluginRegistry } from './monitor/registry'
import { MonitorService } from './monitor/index'
import { PetAPIServer } from './server/api'
import { SystemMonitorPlugin } from './plugins/system'
import { GitHubPlugin } from './plugins/github'
import { OllamaPlugin } from './plugins/ollama'
import { SkinLoader } from './skin-loader'
import { initSound, getSoundPath } from './sound'
import { IPC } from '../shared/ipc-channels'
import { SHUTDOWN_TIMEOUT } from '../shared/constants'

import { DASHBOARD_WIDTH, DASHBOARD_HEIGHT } from '../shared/constants'

// 配置日志
log.transports.file.level = 'info'
log.transports.file.maxSize = 5 * 1024 * 1024
log.transports.console.level = 'debug'

let petWindow: PetWindowManager
let pluginRegistry: PluginRegistry
let monitorService: MonitorService
let apiServer: PetAPIServer
let skinLoader: SkinLoader
let isShuttingDown = false

// 皮肤列表
const availableSkins = ['default-cat', 'butterfly-swordsman', 'chibi-girl']
let currentSkinIndex = 0

function openDashboard(): void {
  // 检查是否已有仪表盘窗口
  const existingDashboard = BrowserWindow.getAllWindows().find(
    (w) => w !== petWindow.getWin() && !w.isDestroyed()
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
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 加载仪表盘页面（复用渲染进程，通过 hash 区分）
  if (process.env.ELECTRON_RENDERER_URL) {
    dashboardWin.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/dashboard`)
  } else {
    dashboardWin.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: '/dashboard' })
  }

  log.info('Dashboard window opened')
}

function cycleNextSkin(): void {
  currentSkinIndex = (currentSkinIndex + 1) % availableSkins.length
  const nextSkin = availableSkins[currentSkinIndex]
  const store = getStore()
  store.set('skin.current', nextSkin)
  log.info(`Skin switched to: ${nextSkin}`)

  const win = petWindow.getWin()
  if (win) {
    win.webContents.send('skin:changed', nextSkin)
  }
}

/**
 * 初始化监控系统和插件
 */
async function initMonitorSystem(): Promise<void> {
  pluginRegistry = new PluginRegistry()

  // 注册内置插件
  pluginRegistry.register(new SystemMonitorPlugin(), { enabled: true, config: {} })
  pluginRegistry.register(new GitHubPlugin(), {
    enabled: false, // 默认禁用，需要配置 token
    config: {}
  })
  pluginRegistry.register(new OllamaPlugin(), {
    enabled: true,
    config: {}
  })

  // 创建监控服务
  monitorService = new MonitorService(pluginRegistry, (status) => {
    // 状态更新时推送给所有渲染窗口
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(IPC.MONITOR_STATUS_UPDATE, status)
    })

    // 更新托盘 tooltip
    updateTrayTooltip(`DesktopXPet — ${status.summary}`)

    // 状态变化时推送系统通知
    if (status.petState === 'error') {
      const errorTools = status.tools.filter((t) => t.status === 'error')
      pushNotification('⚠️ 工具出错', errorTools.map((t) => t.summary).join('\n'))
    } else if (status.petState === 'happy') {
      pushNotification('✅ 任务完成', status.summary)
    }
  })

  // 初始化插件
  await pluginRegistry.initAll()

  // 启动轮询
  monitorService.startAll()

  log.info('Monitor system initialized')
}

/**
 * 初始化 HTTP API 服务器
 */
function initAPIServer(): void {
  const store = getStore()
  const existingToken = store.get('apiToken' as any) as string
  apiServer = new PetAPIServer(existingToken || undefined)

  // 保存 token
  store.set('apiToken' as any, apiServer.getToken())

  // 启动服务器，接收 Push 数据
  apiServer.start((pushData) => {
    monitorService.handlePush(pushData)
  })

  // 写入 CLI 配置文件
  try {
    const configDir = path.join(os.homedir(), '.xpet')
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ token: apiServer.getToken(), port: apiServer.getPort() })
    )
    log.info('CLI config written to ~/.xpet/config.json')
  } catch (err) {
    log.warn('Failed to write CLI config:', err)
  }

  log.info('API server initialized')
}

function setupIPC(): void {
  // 位置管理
  ipcMain.handle(IPC.PET_SET_POSITION, async (_, { x, y }) => {
    petWindow.setPosition(x, y)
  })

  ipcMain.handle(IPC.PET_GET_POSITION, async () => {
    const win = petWindow.getWin()
    if (!win) return null
    const bounds = win.getBounds()
    return { x: bounds.x, y: bounds.y }
  })

  // 右键菜单
  ipcMain.handle(IPC.PET_SHOW_CONTEXT_MENU, async () => {
    const win = petWindow.getWin()
    if (!win) return

    const menu = Menu.buildFromTemplate([
      {
        label: '📊 打开仪表盘',
        click: () => openDashboard()
      },
      { type: 'separator' },
      {
        label: '🎨 切换皮肤',
        submenu: availableSkins.map((skin) => ({
          label: skin,
          click: () => {
            const store = getStore()
            store.set('skin.current', skin)
            win.webContents.send('skin:changed', skin)
          }
        }))
      },
      { type: 'separator' },
      {
        label: '🔄 重置位置',
        click: () => petWindow.resetPosition()
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => app.quit()
      }
    ])

    menu.popup({ window: win })
  })

  // 皮肤图片读取（通过 IPC 返回 base64 data URL，解决 file:// 安全策略拦截问题）
  ipcMain.handle(IPC.SKIN_READ_IMAGE, async (_, imagePath: string) => {
    try {
      const resolvedPath = path.resolve(imagePath)
      // 安全校验：只允许读取 png 和 json 文件
      if (!resolvedPath.endsWith('.png') && !resolvedPath.endsWith('.json')) {
        return null
      }
      if (!fs.existsSync(resolvedPath)) {
        log.warn('Skin file not found:', resolvedPath)
        return null
      }
      const buffer = fs.readFileSync(resolvedPath)
      const ext = resolvedPath.endsWith('.json') ? 'application/json' : 'image/png'
      return `data:${ext};base64,${buffer.toString('base64')}`
    } catch (err) {
      log.warn('Failed to read skin image:', imagePath, err)
      return null
    }
  })

  // 皮肤列表
  ipcMain.handle(IPC.SKIN_LIST, async () => {
    if (skinLoader) {
      return skinLoader.getSkinList().map((s) => ({
        ...s,
        // dirName 用于和 settings 中存储的目录名匹配
        dirName: path.basename(s.path)
      }))
    }
    return availableSkins.map((name) => ({
      name,
      dirName: name,
      path: path.join(app.getAppPath(), 'resources', 'skins', name)
    }))
  })

  // 皮肤切换
  ipcMain.handle(IPC.SKIN_SWITCH, async (_, name: string) => {
    const store = getStore()
    store.set('skin.current', name)
    const win = petWindow.getWin()
    if (win) {
      win.webContents.send('skin:changed', name)
    }
    log.info(`Skin switched via IPC: ${name}`)
  })

  // 设置读写
  ipcMain.handle(IPC.APP_GET_STORE, async () => {
    const store = getStore()
    return store.store
  })

  ipcMain.handle(IPC.APP_SET_STORE, async (_, settings) => {
    const store = getStore()
    for (const [key, value] of Object.entries(settings)) {
      store.set(key, value)
    }

    // 处理开机自启设置变更
    if ('general.autoStart' in settings) {
      app.setLoginItemSettings({
        openAtLogin: settings['general.autoStart'] as boolean,
        openAsHidden: true
      })
    }

    log.info('Settings updated:', Object.keys(settings).join(', '))
  })

  // 退出
  ipcMain.handle(IPC.APP_QUIT, async () => {
    app.quit()
  })

  // 仪表盘（placeholder）
  ipcMain.handle(IPC.APP_OPEN_DASHBOARD, async () => {
    openDashboard()
  })

  // 监控快照
  ipcMain.handle(IPC.MONITOR_GET_SNAPSHOT, async () => {
    return monitorService?.getSnapshot() || {
      petState: 'idle',
      tools: [],
      summary: 'DesktopXPet 待机中'
    }
  })

  // 插件列表
  ipcMain.handle(IPC.PLUGIN_LIST, async () => {
    return pluginRegistry?.getPluginInfos() || []
  })

  // 插件启用/禁用
  ipcMain.handle(IPC.PLUGIN_TOGGLE, async (_, { name, enabled }) => {
    pluginRegistry?.togglePlugin(name, enabled)
  })

  // 音效播放 — 返回文件路径给渲染进程
  ipcMain.on(IPC.SOUND_PLAY, (event, name: string) => {
    const soundPath = getSoundPath(name)
    if (soundPath) {
      event.sender.send('sound:play-file', soundPath)
    }
  })
}

async function gracefulShutdown(): Promise<void> {
  log.info('DesktopXPet: shutting down...')

  try {
    monitorService?.stopAll()
    log.info('  ✓ Monitor service stopped')
  } catch (e) {
    log.error('  ✗ Monitor stop failed:', e)
  }

  try {
    await apiServer?.stop()
    log.info('  ✓ API server stopped')
  } catch (e) {
    log.error('  ✗ API server stop failed:', e)
  }

  try {
    await pluginRegistry?.disposeAll()
    log.info('  ✓ Plugins disposed')
  } catch (e) {
    log.error('  ✗ Plugin dispose failed:', e)
  }

  try {
    petWindow.savePosition()
    log.info('  ✓ Position saved')
  } catch (e) {
    log.error('  ✗ Position save failed:', e)
  }

  try {
    unregisterGlobalShortcuts()
    log.info('  ✓ Shortcuts unregistered')
  } catch (e) {
    log.error('  ✗ Shortcut unregister failed:', e)
  }

  try {
    destroyTray()
    log.info('  ✓ Tray destroyed')
  } catch (e) {
    log.error('  ✗ Tray destroy failed:', e)
  }

  log.info('DesktopXPet: shutdown complete')
}

function shutdownWithTimeout(): void {
  if (isShuttingDown) return
  isShuttingDown = true

  const timer = setTimeout(() => {
    log.error('DesktopXPet: shutdown timed out, force exit')
    app.exit(1)
  }, SHUTDOWN_TIMEOUT)

  gracefulShutdown().finally(() => {
    clearTimeout(timer)
    app.exit(0)
  })
}

app.whenReady().then(async () => {
  log.info('DesktopXPet starting...', {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch
  })

  // 初始化存储
  initStore()

  // 初始化音效
  initSound()

  // 创建宠物窗口
  petWindow = new PetWindowManager()
  petWindow.create()
  petWindow.setupClickThrough()

  // 设置 IPC
  setupIPC()

  // 创建系统托盘
  createTray(petWindow, openDashboard, cycleNextSkin)

  // 注册全局快捷键
  registerGlobalShortcuts(petWindow, openDashboard, cycleNextSkin)

  // 初始化监控系统
  await initMonitorSystem()

  // 初始化 HTTP API 服务器
  initAPIServer()

  // 初始化皮肤加载器
  skinLoader = new SkinLoader()
  const store = getStore()
  const customDirs = (store.get('skin.customSkinDirs') as string[]) || []
  customDirs.forEach((dir: string) => skinLoader.addDirectory(dir))
  await skinLoader.scan()

  // 开机自启设置
  const autoStart = store.get('general.autoStart') as boolean
  if (autoStart !== undefined) {
    app.setLoginItemSettings({
      openAtLogin: autoStart,
      openAsHidden: true
    })
  }

  log.info('DesktopXPet started successfully')
})

app.on('before-quit', (e) => {
  e.preventDefault()
  shutdownWithTimeout()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    shutdownWithTimeout()
  }
})
