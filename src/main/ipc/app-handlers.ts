import { app, ipcMain, BrowserWindow } from 'electron'
import { createLogger } from '../utils/logger'
const log = createLogger('IPC')
import { getStore, storeGet, storeSet } from '../store'
import { setSoundEnabled } from '../sound'
import { IPC } from '../../shared/ipc-channels'
import { container } from '../container'
// 注意: openDashboard 通过延迟导入避免循环依赖,在 handler 调用时再解析
import { openDashboard } from './index'

/**
 * 注册应用设置相关 IPC 处理器
 */
export function registerAppHandlers(): void {
  ipcMain.handle(IPC.APP_GET_STORE, async () => {
    const raw = getStore().store as Record<string, unknown>
    // 过滤敏感字段,避免凭据泄露到渲染进程
    // 包括:明文 token、加密 token、GitHub token(含嵌套)
    const {
      apiToken,
      'apiToken:encrypted': _apiTokenEnc,
      'monitor.plugins.github.config.token': _ghToken,
      'monitor.plugins.github.config.token:encrypted': _ghTokenEnc,
      ...safeStore
    } = raw
    // 清理嵌套在 monitor.plugins.github.config 中的 token
    const mon = safeStore.monitor as Record<string, unknown> | undefined
    if (mon) {
      const plugins = mon.plugins as Record<string, unknown> | undefined
      if (plugins) {
        const github = plugins.github as Record<string, unknown> | undefined
        if (github) {
          const config = github.config as Record<string, unknown> | undefined
          if (config) {
            delete config.token
          }
        }
      }
    }
    return safeStore
  })

  ipcMain.handle(IPC.APP_SET_STORE, async (_, settings) => {
    const store = getStore()
    // 敏感字段黑名单：禁止通过通用设置接口写入，必须走专用的凭据 API
    const sensitiveKeys = new Set([
      'apiToken',
      'apiToken:encrypted',
      'monitor.plugins.github.config.token',
      'monitor.plugins.github.config.token:encrypted',
    ])
    for (const [key, value] of Object.entries(settings)) {
      if (sensitiveKeys.has(key)) {
        log.warn(`Blocked attempt to set sensitive key "${key}" via APP_SET_STORE, use dedicated credential API instead`)
        continue
      }
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

    // 置顶设置生效
    if ('pet.alwaysOnTop' in settings) {
      container.get('petWindow')?.setAlwaysOnTop(settings['pet.alwaysOnTop'] === true)
    }

    // 轮询间隔变更后,重启所有插件定时器使新间隔立即生效
    if ('monitor.defaultPollInterval' in settings) {
      const newInterval = settings['monitor.defaultPollInterval']
      if (typeof newInterval === 'number' && newInterval > 0) {
        container.get('monitorService')?.setDefaultPollInterval(newInterval)
      }
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
      return storeGet('general.petName') || 'DesktopXPet'
    } catch {
      return 'DesktopXPet'
    }
  })

  ipcMain.handle(IPC.APP_SET_PET_NAME, async (_, name: string) => {
    try {
      storeSet('general.petName', name)
      // 通知所有渲染进程名称已更新
      BrowserWindow.getAllWindows().forEach((w) => {
        if (!w.isDestroyed()) w.webContents.send(IPC.PET_NAME_CHANGED, name)
      })
    } catch (err) {
      log.warn('Failed to persist pet name:', err)
    }
  })
}
