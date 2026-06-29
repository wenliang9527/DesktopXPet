import { ipcMain } from 'electron'
import { createLogger } from '../utils/logger'
const log = createLogger('IPC')
import { storeGet, storeSet } from '../store'
import { getSecret, setSecret } from '../secure-store'
import { IPC } from '../../shared/ipc-channels'
import { container } from '../container'

/**
 * 注册凭据管理 IPC 处理器
 */
export function registerCredentialHandlers(): void {
  ipcMain.handle(IPC.GITHUB_SET_CREDENTIALS, async (_, { token, username }: { token?: string; username?: string }) => {
    if (token !== undefined) {
      setSecret('monitor.plugins.github.config.token', token)
    }
    if (username !== undefined) {
      storeSet('monitor.plugins.github.config.username', username)
    }
    // 通知 GitHub 插件重新初始化（如果已注册）
    const registry = container.get('pluginRegistry')
    const plugin = registry?.getPlugin('github')
    if (plugin) {
      const config = {
        token: token !== undefined ? token : (getSecret('monitor.plugins.github.config.token') || ''),
        username: username !== undefined ? username : (storeGet('monitor.plugins.github.config.username') || ''),
      }
      await plugin.init?.(config)
      log.info('GitHub plugin re-initialized with new credentials')
    }
  })

  ipcMain.handle(IPC.GITHUB_GET_CREDENTIALS, async () => {
    const username = storeGet('monitor.plugins.github.config.username') || ''
    const token = getSecret('monitor.plugins.github.config.token') || ''
    return {
      username,
      // 只返回 token 是否已设置,不返回明文
      hasToken: token.length > 0,
    }
  })
}
