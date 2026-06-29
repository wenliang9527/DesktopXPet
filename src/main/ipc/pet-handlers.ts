import { app, ipcMain, Menu, BrowserWindow, shell } from 'electron'
import { createLogger } from '../utils/logger'
const log = createLogger('IPC')
import { storeSet } from '../store'
import { setSkinSoundDir, getUserSoundDir } from '../sound'
import { IPC } from '../../shared/ipc-channels'
import { container } from '../container'
// 注意: openDashboard 通过延迟导入避免循环依赖,在菜单点击时再解析
import { openDashboard } from './index'

/**
 * 注册宠物窗口相关 IPC 处理器
 */
export function registerPetHandlers(): void {
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
            w.webContents.send(IPC.SKIN_CHANGED, skin.dirName)
          }
        })
        // 异步持久化到 store(失败不影响切换)
        try {
          storeSet('skin.current', skin.dirName)
        } catch (err) {
          log.warn('Failed to persist skin to store:', err)
        }
        // 切换皮肤音效
        setSkinSoundDir(skin.path).catch((err) =>
          log.warn('Failed to update skin sound dir:', err)
        )
      },
    }))

    const menu = Menu.buildFromTemplate([
      {
        label: '📊 打开仪表盘',
        click: () => openDashboard(),
      },
      { type: 'separator' },
      {
        label: '🍖 喂食',
        click: () => {
          container.get('nurtureService')?.interact('feed')
        },
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
              if (!w.isDestroyed()) w.webContents.send(IPC.SKINS_RESCANNED)
            })
            log.info('Skin list refreshed from context menu')
          }
        },
      },
      { type: 'separator' },
      {
        label: '📌 置顶',
        type: 'checkbox',
        checked: true,
        click: (item) => petWindow?.setAlwaysOnTop(item.checked),
      },
      { type: 'separator' },
      {
        label: '🔄 重置位置',
        click: () => petWindow?.resetPosition(),
      },
      {
        label: '👁️ 显示/隐藏',
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
}
