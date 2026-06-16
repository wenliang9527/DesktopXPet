import { BrowserWindow, screen, ipcMain } from 'electron'
import { join } from 'path'
import { PET_WINDOW_WIDTH, PET_WINDOW_HEIGHT } from '@shared/constants'
import log from 'electron-log/main'
import { getStore } from './store'

export class PetWindowManager {
  private win: BrowserWindow | null = null
  private isHoveringPet = false

  create(): BrowserWindow {
    const display = screen.getPrimaryDisplay()
    const { width: screenW, height: screenH } = display.workAreaSize

    // 默认位置：屏幕右下角
    const defaultX = screenW - PET_WINDOW_WIDTH - 50
    const defaultY = screenH - PET_WINDOW_HEIGHT - 20

    this.win = new BrowserWindow({
      width: PET_WINDOW_WIDTH,
      height: PET_WINDOW_HEIGHT,
      x: defaultX,
      y: defaultY,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    // 初始设置窗口穿透
    this.win.setIgnoreMouseEvents(true, { forward: true })

    // 恢复上次保存的位置
    this.restorePosition()

    // 加载渲染进程
    if (process.env.ELECTRON_RENDERER_URL) {
      this.win.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
      this.win.loadFile(join(__dirname, '../renderer/index.html'))
    }

    log.info('Pet window created', {
      position: { x: defaultX, y: defaultY },
      size: { width: PET_WINDOW_WIDTH, height: PET_WINDOW_HEIGHT }
    })

    return this.win
  }

  getWin(): BrowserWindow | null {
    return this.win
  }

  setupClickThrough(): void {
    if (!this.win) return

    ipcMain.on('pet:hover-state', (_, hovering: boolean) => {
      if (hovering !== this.isHoveringPet) {
        this.isHoveringPet = hovering
        if (hovering) {
          this.win!.setIgnoreMouseEvents(false)
        } else {
          this.win!.setIgnoreMouseEvents(true, { forward: true })
        }
      }
    })
  }

  savePosition(): void {
    if (!this.win) return
    const bounds = this.win.getBounds()
    getStore().set('pet.position', { x: bounds.x, y: bounds.y })
  }

  restorePosition(): void {
    if (!this.win) return
    try {
      const pos = getStore().get('pet.position')
      if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
        // 验证位置是否在屏幕范围内
        const display = screen.getDisplayNearestPoint({ x: pos.x, y: pos.y })
        const { width: sw, height: sh } = display.workAreaSize
        if (pos.x >= 0 && pos.x < sw && pos.y >= 0 && pos.y < sh) {
          this.win.setPosition(pos.x, pos.y)
        }
      }
    } catch {
      // 忽略错误，使用默认位置
    }
  }

  setPosition(x: number, y: number): void {
    if (this.win) {
      this.win.setPosition(x, y)
      this.savePosition()
    }
  }

  toggleVisibility(): void {
    if (!this.win) return
    if (this.win.isVisible()) {
      this.win.hide()
    } else {
      this.win.show()
    }
  }

  resetPosition(): void {
    if (!this.win) return
    const display = screen.getPrimaryDisplay()
    const { width: screenW, height: screenH } = display.workAreaSize
    const x = screenW - PET_WINDOW_WIDTH - 50
    const y = screenH - PET_WINDOW_HEIGHT - 20
    this.win.setPosition(x, y)
    this.savePosition()
  }

  toggleAlwaysOnTop(enabled: boolean): void {
    if (this.win) {
      this.win.setAlwaysOnTop(enabled)
    }
  }
}
