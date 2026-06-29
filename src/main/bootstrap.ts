import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { createLogger } from './utils/logger'
const log = createLogger('App')
import { PetWindowManager } from './window'
import { initStore, getEffectivePollInterval, storeGet, storeSet } from './store'
import { getSecret, setSecret, migratePlaintextSecrets } from './secure-store'
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
import { NurtureService } from './nurture'
import { initSound, setSkinSoundDir } from './sound'
import { IPC } from '../shared/ipc-channels'
import { SHUTDOWN_TIMEOUT } from '../shared/constants'
import { container } from './container'
import { setupIPC, openDashboard, cycleNextSkin } from './ipc-handlers'
import type { AggregatedStatus } from '../shared/types'

let isShuttingDown = false

/**
 * MonitorService 状态更新回调 — 分发到窗口/托盘/通知/养成服务
 */
function onMonitorStatusUpdate(status: AggregatedStatus): void {
  // 1. 广播到所有渲染窗口
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.MONITOR_STATUS_UPDATE, status)
    }
  })

  // 2. 更新托盘 tooltip
  updateTrayTooltip(`DesktopXPet — ${status.summary}`)

  // 3. 系统通知(同一 completed 事件只通知一次,由 MonitorService 去重)
  if (status.petState === 'error') {
    const errorTools = status.tools.filter((t) => t.status === 'error')
    pushNotification('⚠️ 工具出错', errorTools.map((t) => t.summary).join('\n'))
  } else if (status.petState === 'happy' && status.newCompleted) {
    pushNotification('✅ 任务完成', status.summary)
  }

  // 4. 分发到养成服务,联动计算显示状态
  // 注:computeAndBroadcastDisplayState 会读取 currentPetState,所以先 setPetState
  const ns = container.get('nurtureService')
  if (ns) {
    ns.setPetState(status.petState)
    ns.computeAndBroadcastDisplayState()
    if (status.newCompleted) ns.onTaskCompleted()
  }
}

/**
 * 初始化监控系统和插件
 */
async function initMonitorSystem(): Promise<void> {
  const pluginRegistry = new PluginRegistry()

  pluginRegistry.register(new SystemMonitorPlugin(), { enabled: true, config: {} })
  // GitHub 插件:从加密存储读取用户配置的 token/username 和 enabled 状态
  const githubEnabled = storeGet('monitor.plugins.github.enabled') ?? false
  const githubUsername = storeGet('monitor.plugins.github.config.username') || ''
  const githubToken = getSecret('monitor.plugins.github.config.token') || ''
  pluginRegistry.register(new GitHubPlugin(), {
    enabled: githubEnabled,
    config: { token: githubToken, username: githubUsername },
  })
  pluginRegistry.register(new OllamaPlugin(), {
    enabled: true,
    config: {},
  })

  const monitorService = new MonitorService(
    pluginRegistry,
    onMonitorStatusUpdate,
    getEffectivePollInterval()
  )

  await pluginRegistry.initAll()
  monitorService.startAll()

  container.register('pluginRegistry', pluginRegistry)
  container.register('monitorService', monitorService)

  log.info('Monitor system initialized')
}

/**
 * 写入 CLI 配置文件(尝试多个路径,确保扩展能读取 token)
 */
function writeCliConfig(token: string, port: number): void {
  // 尝试多个路径写入 CLI 配置,确保扩展能读取 token
  const configData = JSON.stringify({ token, port })
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
      // 写入时设置文件权限 0600(仅所有者可读写),防止其他用户读取 token
      fs.writeFileSync(configPath, configData, { mode: 0o600 })
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
}

/**
 * 初始化 HTTP API 服务器
 */
async function initAPIServer(): Promise<void> {
  const existingToken = getSecret('apiToken')
  const apiServer = new PetAPIServer(existingToken || undefined)

  // 先启动 API server,再写 config(避免写 config 失败导致 server 不启动)
  const monitorService = container.get('monitorService')
  // await start() 等待实际端口绑定完成,确保 getPort() 返回正确端口
  const actualPort = await apiServer.start((pushData) => {
    monitorService?.handlePush(pushData)
  })

  // 加密存储 API token
  try {
    setSecret('apiToken', apiServer.getToken())
  } catch {
    log.warn('Failed to persist apiToken to secure store')
  }

  writeCliConfig(apiServer.getToken(), actualPort)

  // 打印 token 到日志(脱敏,只显示前 4 位,方便用户识别但不泄露完整 token)
  const token = apiServer.getToken()
  const maskedToken = token.length > 8 ? `${token.slice(0, 4)}...${token.slice(-4)}` : '****'
  log.info(`API Token: ${maskedToken} (Port: ${actualPort})`)
  log.info('Full token is in ~/.xpet/config.json — IDE extensions read it automatically')
  log.info(
    'If extensions cannot connect, set token manually in IDE settings: desktopxpet-monitor.serverToken'
  )

  container.register('apiServer', apiServer)
  log.info(`API server initialized on port ${actualPort}`)
}

/**
 * 优雅关闭 — 声明式任务列表
 */
async function gracefulShutdown(): Promise<void> {
  log.info('DesktopXPet: shutting down...')

  const tasks: Array<{ name: string; fn: () => unknown }> = [
    { name: 'Nurture service', fn: () => container.get('nurtureService')?.stop() },
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
 * 预创建用户数据子目录(skins/sounds)
 * 打包后 resources/ 在 app.asar 内只读,用户需要可写目录来添加皮肤/音效
 * 在此处提前创建,避免后续 initSound/SkinLoader 中 mkdir 时遇到 EPERM
 */
function ensureUserDataDirs(): void {
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
}

/**
 * 初始化皮肤系统:加载自定义目录、扫描、注册容器、设置初始皮肤音效目录
 */
async function initSkinSystem(skinLoader: SkinLoader): Promise<void> {
  const customDirs = storeGet('skin.customSkinDirs') || []
  customDirs.forEach((dir: string) => skinLoader.addDirectory(dir))
  await skinLoader.scan()
  container.register('skinLoader', skinLoader)

  // 设置初始皮肤的音效目录
  const currentSkinDirName = storeGet('skin.current') || ''
  if (currentSkinDirName) {
    const skinList = skinLoader.getSkinList()
    const skinEntry = skinList.find((s) => s.dirName === currentSkinDirName)
    if (skinEntry) {
      // 启动时校验 unlockLevel:若当前皮肤未解锁(等级回退/手动改 config 等边缘情况),
      // 回退到第一个已解锁皮肤,避免启动时加载未解锁皮肤资源
      const nurtureService = container.get('nurtureService')
      const currentLevel = nurtureService?.getState()?.growth.level ?? 1
      const unlockLevel = skinEntry.manifest.unlockLevel ?? 1
      if (unlockLevel <= currentLevel) {
        await setSkinSoundDir(skinEntry.path)
      } else {
        log.warn(
          `Saved skin "${currentSkinDirName}" requires level ${unlockLevel}, current ${currentLevel}; falling back to first unlocked skin`
        )
        const unlocked = skinLoader.getUnlockedSkins(currentLevel)
        if (unlocked.length > 0) {
          try {
            storeSet('skin.current', unlocked[0].dirName)
          } catch {
            // store 写入失败不阻塞,内存值已更新
          }
          await setSkinSoundDir(unlocked[0].path)
        }
      }
    }
  }
}

/**
 * 初始化养成服务
 */
function initNurture(): NurtureService {
  const nurtureService = new NurtureService()
  nurtureService.start()
  container.register('nurtureService', nurtureService)

  // 注入当前皮肤的 states 配置(联动养成系统)
  injectSkinStatesToNurture(nurtureService)

  return nurtureService
}

/**
 * 把当前皮肤的 states 配置注入到 NurtureService(皮肤切换时也需要调用)
 */
function injectSkinStatesToNurture(nurtureService: NurtureService): void {
  const skinLoader = container.get('skinLoader')
  if (!skinLoader) return
  const currentSkinDirName = storeGet('skin.current') || ''
  if (!currentSkinDirName) return
  const skinList = skinLoader.getSkinList()
  const skinEntry = skinList.find((s) => s.dirName === currentSkinDirName)
  if (skinEntry) {
    // 校验 unlockLevel:未解锁皮肤不注入 states(避免未解锁皮肤的状态触发)
    const currentLevel = nurtureService.getState()?.growth.level ?? 1
    const unlockLevel = skinEntry.manifest.unlockLevel ?? 1
    if (unlockLevel <= currentLevel) {
      nurtureService.setSkinStates(skinEntry.manifest.states)
    } else {
      // 未解锁则改用第一个已解锁皮肤的 states(或 undefined,由 NurtureService 兜底)
      const unlocked = skinLoader.getUnlockedSkins(currentLevel)
      if (unlocked.length > 0) {
        nurtureService.setSkinStates(unlocked[0].manifest.states)
      }
    }
  }
}

/**
 * 应用开机自启设置
 */
function applyAutoStartSetting(): void {
  const autoStart = storeGet('general.autoStart')
  if (autoStart !== undefined) {
    app.setLoginItemSettings({
      openAtLogin: autoStart === true,
      openAsHidden: true,
    })
  }
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

  ensureUserDataDirs()
  initStore()
  try {
    migratePlaintextSecrets()
  } catch (err) {
    log.warn('Failed to migrate plaintext secrets (non-fatal):', err)
  }
  await initSound()

  const petWindow = new PetWindowManager()
  petWindow.create()
  petWindow.setupClickThrough()
  container.register('petWindow', petWindow)

  const skinLoader = new SkinLoader()
  await initSkinSystem(skinLoader)

  setupIPC()
  createTray(petWindow, openDashboard, cycleNextSkin, skinLoader)
  registerGlobalShortcuts(petWindow, openDashboard, cycleNextSkin)

  await initMonitorSystem()
  initNurture()
  await initAPIServer()
  applyAutoStartSetting()

  log.info('DesktopXPet started successfully')
}
