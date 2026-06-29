import type { AggregatedStatus } from '@shared/types'

/**
 * EventDeduplicator — 事件去重器
 * 负责检测"新出现"的 completed 事件并去重，确保同一 completed 事件在时间窗口内只通知一次。
 */
export class EventDeduplicator {
  // 已通知过的 completed 事件 key 集合（`${tool}|${timestamp}`），用于通知去重
  private notifiedKeys: Set<string> = new Set()
  // completed 事件去重时间窗口(与 aggregateStatus 中 30 秒判定保持一致)
  private readonly windowMs: number

  constructor(windowMs: number = 30_000) {
    this.windowMs = windowMs
  }

  /**
   * 检测当前状态中"新出现"的 completed 事件（未通知过），将其标记为已通知。
   * 同一 completed 事件（tool + timestamp）在时间窗口内只标记一次。
   *
   * @returns 是否存在新的 completed 事件
   */
  detectNewCompleted(status: AggregatedStatus, now: number): boolean {
    let hasNew = false
    for (const t of status.tools) {
      if (t.status === 'completed' && now - t.timestamp < this.windowMs) {
        const key = `${t.tool}|${t.timestamp}`
        if (!this.notifiedKeys.has(key)) {
          hasNew = true
          this.notifiedKeys.add(key)
        }
      }
    }
    return hasNew
  }

  /**
   * 清理已通知集合中过期的 key（超过时间窗口），避免集合无限增长
   */
  cleanup(now: number): void {
    for (const key of this.notifiedKeys) {
      const idx = key.lastIndexOf('|')
      if (idx > 0) {
        const ts = Number(key.slice(idx + 1))
        if (now - ts >= this.windowMs) {
          this.notifiedKeys.delete(key)
        }
      }
    }
  }
}
