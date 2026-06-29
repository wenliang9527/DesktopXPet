import { ipcMain, shell } from 'electron'
import { createLogger } from '../utils/logger'
const log = createLogger('IPC')
import { getSoundDataUrl, reloadSound, getUserSoundDir } from '../sound'
import { IPC } from '../../shared/ipc-channels'

/**
 * 注册音效相关 IPC 处理器
 */
export function registerSoundHandlers(): void {
  // 重新加载音效(用户添加/替换音效后调用)
  ipcMain.handle(IPC.SOUND_RELOAD, async () => {
    await reloadSound()
    log.info('Sounds reloaded')
  })

  // 打开用户音效目录(资源管理器)
  ipcMain.handle(IPC.SOUND_OPEN_USER_DIR, async () => {
    const dir = getUserSoundDir()
    shell.openPath(dir)
    log.info(`Opened sound directory: ${dir}`)
  })

  ipcMain.on(IPC.SOUND_PLAY, (event, name: string) => {
    // sandbox 模式下 file:/// 协议被禁止,改用 data URL 播放音效
    const dataUrl = getSoundDataUrl(name)
    if (dataUrl) {
      event.sender.send(IPC.SOUND_PLAY_FILE, dataUrl)
    }
  })
}
