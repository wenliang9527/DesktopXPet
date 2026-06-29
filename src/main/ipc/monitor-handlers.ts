import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import { container } from '../container'

/**
 * 注册监控相关 IPC 处理器
 */
export function registerMonitorHandlers(): void {
  ipcMain.handle(IPC.MONITOR_GET_SNAPSHOT, async () => {
    return (
      container.get('monitorService')?.getSnapshot() || {
        petState: 'idle',
        tools: [],
        summary: 'DesktopXPet 待机中',
      }
    )
  })
}
