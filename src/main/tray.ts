import { Tray, Menu, app, nativeImage } from 'electron'
import { join } from 'path'
import log from 'electron-log/main'
import type { PetWindowManager } from './window'

let tray: Tray | null = null

export function createTray(
  petWindow: PetWindowManager,
  openDashboard: () => void,
  switchSkin: () => void
): Tray {
  // 创建一个简单的托盘图标
  const iconPath = join(app.getAppPath(), 'resources', 'icons', 'tray-icon.png')
  let trayIcon: ReturnType<typeof nativeImage.createFromPath>

  try {
    trayIcon = nativeImage.createFromPath(iconPath)
    if (trayIcon.isEmpty()) {
      // 如果没有图标文件，创建一个空的 16x16 图标
      trayIcon = nativeImage.createEmpty()
    }
  } catch {
    trayIcon = nativeImage.createEmpty()
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('DesktopXPet — 待机中')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '📊 打开仪表盘',
      click: () => openDashboard()
    },
    { type: 'separator' },
    {
      label: '🎨 切换皮肤',
      click: () => switchSkin()
    },
    {
      label: '⚙️ 设置',
      click: () => openDashboard() // 暂时复用，后续打开设置面板
    },
    { type: 'separator' },
    {
      label: '📌 置顶',
      type: 'checkbox',
      checked: true,
      click: (item) => petWindow.toggleAlwaysOnTop(item.checked)
    },
    { type: 'separator' },
    {
      label: '🔄 重置位置',
      click: () => petWindow.resetPosition()
    },
    {
      label: '👁️ 显示/隐藏',
      click: () => petWindow.toggleVisibility()
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    petWindow.toggleVisibility()
  })

  log.info('System tray created')
  return tray
}

export function updateTrayTooltip(tooltip: string): void {
  if (tray) {
    // Windows tooltip 有 128 字符限制
    tray.setToolTip(tooltip.slice(0, 127))
  }
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
