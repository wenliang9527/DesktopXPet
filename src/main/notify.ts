import { Notification, nativeImage, app } from 'electron'
import { join } from 'path'
import { createLogger } from './utils/logger'
import { storeGet } from './store'
const log = createLogger('Notification')

let lastNotificationTime = 0
const MIN_INTERVAL = 5000 // 最小通知间隔 5 秒（任意通知之间）

// 相同内容通知的去重：防止 forceSync 每 30s 重新广播触发重复通知
// key = `${title}|${body}`，value = 上次显示该内容的时间戳
const sameContentLastShown = new Map<string, number>()
const SAME_CONTENT_DEDUP_MS = 5 * 60_000 // 相同内容 5 分钟内不重复

/**
 * 推送系统通知
 */
export function pushNotification(title: string, body: string): void {
  // 检查用户是否启用通知
  const showNotifications = storeGet('behavior.showNotifications') ?? true
  if (!showNotifications) {
    log.info(`Notification suppressed (disabled by user): ${title} - ${body}`)
    return
  }

  const now = Date.now()
  if (now - lastNotificationTime < MIN_INTERVAL) {
    return // 防止通知轰炸
  }

  // 相同内容去重：forceSync 兜底广播会周期性重发当前状态，
  // 对相同 title+body 在 5 分钟内只通知一次，避免持续错误状态下的重复弹窗。
  const contentKey = `${title}|${body}`
  const lastShown = sameContentLastShown.get(contentKey)
  if (lastShown && now - lastShown < SAME_CONTENT_DEDUP_MS) {
    return
  }

  try {
    if (Notification.isSupported()) {
      const iconPath = join(app.getAppPath(), 'resources', 'icons', 'icon.png')
      let notificationIcon: Electron.NativeImage | undefined
      try {
        const img = nativeImage.createFromPath(iconPath)
        notificationIcon = img.isEmpty() ? undefined : img
      } catch {
        notificationIcon = undefined
      }

      const notification = new Notification({
        title,
        body,
        silent: false,
        icon: notificationIcon,
      })
      notification.show()
      lastNotificationTime = now
      sameContentLastShown.set(contentKey, now)
      // 清理过期的相同内容记录，避免 Map 无限增长
      if (sameContentLastShown.size > 50) {
        for (const [k, t] of sameContentLastShown) {
          if (now - t >= SAME_CONTENT_DEDUP_MS) {
            sameContentLastShown.delete(k)
          }
        }
      }
      log.info(`Notification: ${title} - ${body}`)
    }
  } catch (err) {
    log.warn('Failed to show notification:', err)
  }
}
