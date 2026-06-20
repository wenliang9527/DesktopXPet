import { globalShortcut } from 'electron'
import { createLogger } from './utils/logger'
const log = createLogger('Shortcuts')
import type { PetWindowManager } from './window'

export function registerGlobalShortcuts(
  petWindow: PetWindowManager,
  openDashboard: () => void,
  cycleNextSkin: () => void
): void {
  // Ctrl+Shift+P: 显示/隐藏宠物
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    petWindow.toggleVisibility()
    log.info('Shortcut: toggle pet visibility')
  })

  // Ctrl+Shift+D: 打开仪表盘
  globalShortcut.register('CommandOrControl+Shift+D', () => {
    openDashboard()
    log.info('Shortcut: open dashboard')
  })

  // Ctrl+Shift+S: 切换下一个皮肤
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    cycleNextSkin()
    log.info('Shortcut: cycle next skin')
  })

  log.info('Global shortcuts registered')
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll()
  log.info('Global shortcuts unregistered')
}
