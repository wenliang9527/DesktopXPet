import { app } from 'electron'
import { createLogger } from './utils/logger'
const log = createLogger('App')
import { initApp, shutdownWithTimeout } from './bootstrap'

/**
 * 忽略 EPIPE / EIO 等无害的 I/O 错误
 * 当父进程(electron-vite dev server)被终止时,stdout/stderr 管道断开
 * 会触发这些错误,属于正常行为,不应导致应用崩溃弹窗
 */
process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
  const harmless = ['EPIPE', 'EIO', 'EBADF', 'ENXIO']
  if (err?.code && harmless.includes(err.code)) {
    // 管道已断,静默忽略(此时日志可能也写不出去)
    return
  }
  // 其他未捕获异常仍然打印(尽最大努力)
  try {
    console.error('[FATAL] Uncaught exception:', err)
  } catch {
    // 连 console.error 也失败就彻底放弃
  }
})

process.on('unhandledRejection', (reason: unknown) => {
  try {
    console.error('[FATAL] Unhandled rejection:', reason)
  } catch {
    // ignore
  }
})

// 单例锁:确保只有一个 DesktopXPet 实例运行
// 避免多实例竞争 API 端口(9527),导致 IDE 扩展连接到错误实例
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  log.info('Another DesktopXPet instance is already running, quitting')
  app.quit()
} else {
  app.on('second-instance', () => {
    // 第二实例启动时,聚焦到已有实例(此处无主窗口,宠物窗口由 PetWindowManager 管理)
    log.warn('Second instance attempt detected, already running')
  })

  app.whenReady().then(() => {
    initApp().catch((err) => {
      log.error('Failed to initialize app:', err)
      app.quit()
    })
  })
}

app.on('before-quit', (e) => {
  e.preventDefault()
  shutdownWithTimeout()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    shutdownWithTimeout()
  }
})
