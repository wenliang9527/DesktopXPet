import { BrowserWindow } from 'electron'
import path from 'path'
import { createLogger } from '../utils/logger'
const log = createLogger('IPC')
import { storeGet, storeSet } from '../store'
import { setSkinSoundDir } from '../sound'
import { IPC } from '../../shared/ipc-channels'
import { DASHBOARD_WIDTH, DASHBOARD_HEIGHT } from '../../shared/constants'
import { BUILTIN_SKINS } from '../../shared/skins'
import { container } from '../container'

import { registerPetHandlers } from './pet-handlers'
import { registerSkinHandlers } from './skin-handlers'
import { registerAppHandlers } from './app-handlers'
import { registerMonitorHandlers } from './monitor-handlers'
import { registerCredentialHandlers } from './credential-handlers'
import { registerPluginHandlers } from './plugin-handlers'
import { registerSoundHandlers } from './sound-handlers'
import { registerNurtureHandlers } from './nurture-handlers'

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

  let nextSkin: string
  if (skinLoader && skinLoader.getSkinList().length > 0) {
    let currentSkin = storeGet('skin.current') || BUILTIN_SKINS[0]
    // 兜底:若 store 中存的值匹配不上 dirName(可能是旧版本存的 manifest.name),
    // 用 manifest.name 反查对应的 dirName,确保 getNextSkin 按 dirName 正确匹配
    const skinListForFallback = skinLoader.getSkinList()
    if (!skinListForFallback.find((s) => s.dirName === currentSkin)) {
      const matchedByName = skinListForFallback.find((s) => s.name === currentSkin)
      if (matchedByName) {
        currentSkin = matchedByName.dirName
      }
    }
    // 只在已解锁皮肤中循环,避免托盘切换跳到未解锁皮肤(如婚纱)
    const currentLevel = container.get('nurtureService')?.getState()?.growth.level ?? 1
    nextSkin = skinLoader.getNextUnlockedSkin(currentSkin, currentLevel)
  } else {
    currentSkinIndex = (currentSkinIndex + 1) % BUILTIN_SKINS.length
    nextSkin = BUILTIN_SKINS[currentSkinIndex]
  }

  try {
    storeSet('skin.current', nextSkin)
  } catch (err) {
    log.warn('Failed to persist skin to store:', err)
  }
  log.info(`Skin switched to: ${nextSkin}`)

  // 切换皮肤的音效目录
  const skinDir = skinLoader?.getSkinDir(nextSkin) || null
  // 注意: 皮肤目录名可能是 dirName，需要通过 getSkinList 查找完整路径
  const skinList = skinLoader?.getSkinList() || []
  const skinEntry = skinList.find((s) => s.dirName === nextSkin)
  const resolvedDir = skinEntry?.path || skinDir
  setSkinSoundDir(resolvedDir || null).catch((err) =>
    log.warn('Failed to update skin sound dir:', err)
  )

  const win = petWindow?.getWin()
  if (win) {
    win.webContents.send(IPC.SKIN_CHANGED, nextSkin)
  }
}

/**
 * 注册所有 IPC 处理器
 */
export function setupIPC(): void {
  registerPetHandlers()
  registerSkinHandlers()
  registerAppHandlers()
  registerMonitorHandlers()
  registerCredentialHandlers()
  registerPluginHandlers()
  registerSoundHandlers()
  registerNurtureHandlers()
}
