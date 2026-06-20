import { Notification } from 'electron'
import { createLogger } from './utils/logger'
const log = createLogger('Notification')

let lastNotificationTime = 0
const MIN_INTERVAL = 5000 // 最小通知间隔 5 秒

/**
 * 推送系统通知
 */
export function pushNotification(title: string, body: string): void {
  const now = Date.now()
  if (now - lastNotificationTime < MIN_INTERVAL) {
    return // 防止通知轰炸
  }

  try {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title,
        body,
        silent: false,
        icon: undefined, // 使用应用图标
      })
      notification.show()
      lastNotificationTime = now
      log.info(`Notification: ${title} - ${body}`)
    }
  } catch (err) {
    log.warn('Failed to show notification:', err)
  }
}
