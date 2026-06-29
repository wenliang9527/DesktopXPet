import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import { container } from '../container'

/**
 * 注册插件管理 IPC 处理器
 */
export function registerPluginHandlers(): void {
  ipcMain.handle(IPC.PLUGIN_LIST, async () => {
    return container.get('pluginRegistry')?.getPluginInfos() || []
  })

  ipcMain.handle(IPC.PLUGIN_TOGGLE, async (_, { name, enabled }) => {
    container.get('pluginRegistry')?.togglePlugin(name, enabled)
  })
}
