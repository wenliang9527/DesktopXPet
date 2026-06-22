import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { createLogger } from './utils/logger'
const log = createLogger('App')
import { PetWindowManager } from './window'
import { initStore, getStore, getEffectivePollInterval } from './store'
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
import { initSound } from './sound'
import { IPC } from '../shared/ipc-channels'
import { SHUTDOWN_TIMEOUT } from '../shared/constants'
import { container } from './container'
import { setupIPC, openDashboard, cycleNextSkin } from './ipc-handlers'

let isShuttingDown = false

/**
 * 初始化监控系统和插件
 */
async function initMonitorSystem(): Promise<void> {
  const pluginRegistry = new PluginRegistry()

  pluginRegistry.register(new SystemMonitorPlugin(), { enabled: true, config: {} })
  pluginRegistry.register(new GitHubPlugin(), {
    enabled: false,
    config: {},
  })
  pluginRegistry.register(new OllamaPlugin(), {
    enabled: true,
    config: {},
  })

  const monitorService = new MonitorService(pluginRegistry, (status) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.MONITOR_STATUS_UPDATE, status)
      }
    })

    updateTrayTooltip(`DesktopXPet — ${status.summary}`)

    if (status.petState === 'error') {
      const errorTools = status.tools.filter((t) => t.status === 'error')
      pushNotification('⚠️ 工具出错', errorTools.map((t) => t.summary).join('\n'))
    } else if (status.petState === 'happy' && status.newCompleted) {
      // 同一 completed 事件只通知一次(由 MonitorService 去重)
      pushNotification('✅ 任务完成', status.summary)
    }
  }, getEffectivePollInterval())

  await pluginRegistry.initAll()
  monitorService.startAll()

  container.register('pluginRegistry', pluginRegistry)
  container.register('monitorService', monitorService)

  log.info('Monitor system initialized')
}

/**
 * 初始化 HTTP API 服务器
 */
function initAPIServer(): void {
  const store = getStore()
  const existingToken = store.get('apiToken' as any) as string
  const apiServer = new PetAPIServer(existingToken || undefined)

  // 先启动 API server,再写 config(避免写 config 失败导致 server 不启动)
  const monitorService = container.get('monitorService')
  apiServer.start((pushData) => {
    monitorService?.handlePush(pushData)
  })

  try {
    store.set('apiToken' as any, apiServer.getToken())
  } catch {
    log.warn('Failed to persist apiToken to store')
  }

  // 尝试多个路径写入 CLI 配置,确保扩展能读取 token
  const configData = JSON.stringify({ token: apiServer.getToken(), port: apiServer.getPort() })
  const configPaths = [
    path.join(os.homedir(), '.xpet', 'config.json'), // 首选:~/.xpet/config.json
    path.join(os.homedir(), '.desktopxpet', 'config.json'), // 备选:~/.desktopxpet/config.json
    path.join(os.tmpdir(), 'desktopxpet-config.json'), // 兜底:临时目录
  ]

  let configWritten = false
  for (const configPath of configPaths) {
    try {
      const configDir = path.dirname(configPath)
      fs.mkdirSync(configDir, { recursive: true })
      fs.writeFileSync(configPath, configData)
      log.info(`CLI config written to ${configPath}`)
      configWritten = true
      break
    } catch {
      // 继续尝试下一个路径
    }
  }

  if (!configWritten) {
    log.warn('Failed to write CLI config to any location')
  }

  // 始终打印 token 到日志,方便用户手动配置
  log.info(`API Token: ${apiServer.getToken()} (Port: ${apiServer.getPort()})`)
  log.info(
    'If extensions cannot connect, set token manually in IDE settings: desktopxpet-monitor.serverToken'
  )

  container.register('apiServer', apiServer)
  log.info(`API server initialized on port ${apiServer.getPort()}`)
}

/**
 * 优雅关闭 — 声明式任务列表
 */
async function gracefulShutdown(): Promise<void> {
  log.info('DesktopXPet: shutting down...')

  const tasks: Array<{ name: string; fn: () => unknown }> = [
    { name: 'Monitor service', fn: () => container.get('monitorService')?.stopAll() },
    { name: 'API server', fn: () => container.get('apiServer')?.stop() },
    { name: 'Plugins', fn: () => container.get('pluginRegistry')?.disposeAll() },
    { name: 'Position', fn: () => container.get('petWindow')?.savePositionNow() },
    { name: 'Shortcuts', fn: () => unregisterGlobalShortcuts() },
    { name: 'Tray', fn: () => destroyTray() },
  ]

  for (const task of tasks) {
    try {
      await task.fn()
      log.info(`  ✓ ${task.name} stopped`)
    } catch (e) {
      log.error(`  ✗ ${task.name} stop failed:`, e)
    }
  }

  log.info('DesktopXPet: shutdown complete')
}

/**
 * 带超时的关闭(防止关闭流程卡住)
 */
export function shutdownWithTimeout(): void {
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

/**
 * 应用主初始化流程(app.whenReady 后调用)
 */
export async function initApp(): Promise<void> {
  log.info('DesktopXPet starting...', {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
  })

  // 在其他初始化之前,先创建用户数据子目录(skins/sounds)
  // 打包后 resources/ 在 app.asar 内只读,用户需要可写目录来添加皮肤/音效
  // 在此处提前创建,避免后续 initSound/SkinLoader 中 mkdir 时遇到 EPERM
  const userDataDir = app.getPath('userData')
  for (const subDir of ['skins', 'sounds']) {
    const dir = path.join(userDataDir, subDir)
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    } catch (err) {
      log.warn(`Failed to pre-create directory ${dir}:`, err)
    }
  }

  initStore()
  await initSound()

  const petWindow = new PetWindowManager()
  petWindow.create()
  petWindow.setupClickThrough()
  container.register('petWindow', petWindow)

  const skinLoader = new SkinLoader()
  const store = getStore()
  const customDirs = (store.get('skin.customSkinDirs') as string[]) || []
  customDirs.forEach((dir: string) => skinLoader.addDirectory(dir))
  await skinLoader.scan()
  container.register('skinLoader', skinLoader)

  setupIPC()

  createTray(petWindow, openDashboard, cycleNextSkin, skinLoader)
  registerGlobalShortcuts(petWindow, openDashboard, cycleNextSkin)

  await initMonitorSystem()
  initAPIServer()

  const autoStart = store.get('general.autoStart')
  if (autoStart !== undefined) {
    app.setLoginItemSettings({
      openAtLogin: autoStart === true,
      openAsHidden: true,
    })
  }

  log.info('DesktopXPet started successfully')
}
