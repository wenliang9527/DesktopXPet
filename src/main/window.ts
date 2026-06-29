import { BrowserWindow, screen, ipcMain } from 'electron'
import { join } from 'path'
import { PET_WINDOW_WIDTH, PET_WINDOW_HEIGHT } from '@shared/constants'
import { createLogger } from './utils/logger'
const log = createLogger('PetWindowManager')
import { storeGet, storeSet } from './store'

export class PetWindowManager {
  private win: BrowserWindow | null = null
  private isHoveringPet = false
  private savePositionTimer: ReturnType<typeof setTimeout> | null = null
  private lastSaveErrorLogged = 0
  private clickThroughEnabled = true // 跟踪穿透状态

  create(): BrowserWindow {
    const display = screen.getPrimaryDisplay()
    const { width: screenW, height: screenH } = display.workAreaSize
    const workArea = display.workArea

    const defaultX = workArea.x + screenW - PET_WINDOW_WIDTH - 50
    const defaultY = workArea.y + screenH - PET_WINDOW_HEIGHT - 20

    this.win = new BrowserWindow({
      width: PET_WINDOW_WIDTH,
      height: PET_WINDOW_HEIGHT,
      x: defaultX,
      y: defaultY,
      frame: false,
      transparent: true,
      alwaysOnTop: storeGet('pet.alwaysOnTop') ?? true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    // 初始设置窗口穿透
    this.setClickThrough(true)

    // 焦点管理：获得焦点时禁用穿透（允许右键等交互），失去焦点时恢复穿透
    this.win.on('focus', () => {
      this.setClickThrough(false)
    })
    this.win.on('blur', () => {
      this.setClickThrough(true)
    })

    // 恢复上次保存的位置
    this.restorePosition()

    // 加载渲染进程
    if (process.env.ELECTRON_RENDERER_URL) {
      this.win.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
      this.win.loadFile(join(__dirname, '../renderer/index.html'))
    }

    // 渲染进程加载失败日志（保留，用于诊断）
    this.win.webContents.on('did-fail-load', (_e, code, desc) => {
      log.error(`Renderer failed to load: code=${code}, desc=${desc}`)
    })

    // 调试模式自动打开 DevTools
    if (process.env.DEBUG_DEVTOOLS) {
      this.win.webContents.openDevTools({ mode: 'detach' })
    }

    log.info('Pet window created', {
      position: { x: defaultX, y: defaultY },
      size: { width: PET_WINDOW_WIDTH, height: PET_WINDOW_HEIGHT },
    })

    return this.win
  }

  /**
   * 统一控制穿透状态，避免重复调用
   */
  private setClickThrough(enabled: boolean): void {
    if (!this.win || this.clickThroughEnabled === enabled) return
    this.clickThroughEnabled = enabled
    this.win.setIgnoreMouseEvents(enabled, { forward: enabled })
  }

  getWin(): BrowserWindow | null {
    return this.win
  }

  setupClickThrough(): void {
    if (!this.win) return

    ipcMain.on('pet:hover-state', (_, hovering: boolean) => {
      // 窗口可能已销毁（优雅关闭期间或意外关闭），守卫避免崩溃
      if (!this.win || this.win.isDestroyed()) return
      if (hovering !== this.isHoveringPet) {
        this.isHoveringPet = hovering
        if (hovering) {
          this.win.setIgnoreMouseEvents(false)
        } else {
          // 只在窗口没有焦点时才恢复穿透
          if (!this.win.isFocused()) {
            this.win.setIgnoreMouseEvents(true, { forward: true })
          }
        }
      }
    })
  }

  savePosition(): void {
    if (!this.win) return
    // 防抖：500ms 内只保存一次，避免拖动时频繁写入
    if (this.savePositionTimer) clearTimeout(this.savePositionTimer)
    this.savePositionTimer = setTimeout(() => {
      this.doSavePosition()
    }, 500)
  }

  /**
   * 立即保存位置（跳过防抖）— 用于优雅关闭时确保位置已持久化
   */
  savePositionNow(): void {
    if (this.savePositionTimer) {
      clearTimeout(this.savePositionTimer)
      this.savePositionTimer = null
    }
    this.doSavePosition()
  }

  private doSavePosition(): void {
    if (!this.win) return
    const bounds = this.win.getBounds()
    try {
      storeSet('pet.position', { x: bounds.x, y: bounds.y })
    } catch (err) {
      // 限制错误日志频率：每 30 秒最多打印一次
      const now = Date.now()
      if (now - this.lastSaveErrorLogged > 30000) {
        this.lastSaveErrorLogged = now
        log.warn('Failed to save pet position (EPERM — file locked by antivirus/defender)')
      }
    }
  }

  restorePosition(): void {
    if (!this.win) return
    try {
      const pos = storeGet('pet.position')
      if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
        const display = screen.getDisplayNearestPoint({ x: pos.x, y: pos.y })
        const workArea = display.workArea
        const clampedX = Math.max(
          workArea.x,
          Math.min(pos.x, workArea.x + workArea.width - PET_WINDOW_WIDTH)
        )
        const clampedY = Math.max(
          workArea.y,
          Math.min(pos.y, workArea.y + workArea.height - PET_WINDOW_HEIGHT)
        )
        this.win.setPosition(clampedX, clampedY)
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
    const cursorPoint = screen.getCursorScreenPoint()
    const display = screen.getDisplayNearestPoint(cursorPoint)
    const { width: screenW, height: screenH } = display.workAreaSize
    const workArea = display.workArea
    const x = workArea.x + screenW - PET_WINDOW_WIDTH - 50
    const y = workArea.y + screenH - PET_WINDOW_HEIGHT - 20
    this.win.setPosition(x, y)
    this.savePosition()
  }

  setAlwaysOnTop(enabled: boolean): void {
    if (this.win) {
      this.win.setAlwaysOnTop(enabled)
    }
  }
}
