import type { MonitorStatus, PushStatus } from '@shared/types'

/**
 * PushDataManager — 推送数据管理器
 * 负责管理 Push 推送数据的缓存、过期清理与读取。
 *
 * 缓存中存储 { data, expiresAt, pushedAt }：
 *   - expiresAt: 过期时间（pushedAt + TTL），过期后不再参与聚合
 *   - pushedAt: 推送入缓存的固定时间戳，用作聚合时的 timestamp，
 *     避免每次聚合用 now 导致去重 key 漂移
 */
export class PushDataManager {
  private cache: Map<string, { data: PushStatus; expiresAt: number; pushedAt: number }> = new Map()
  private readonly ttlMs: number

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs
  }

  /**
   * 缓存一条 Push 推送数据
   */
  set(push: PushStatus): void {
    const now = Date.now()
    this.cache.set(push.tool, {
      data: push,
      expiresAt: now + this.ttlMs,
      pushedAt: now,
    })
  }

  /**
   * 获取所有未过期的推送状态，转换为 MonitorStatus 格式。
   * 使用 pushedAt 作为 timestamp（而非当前时间），避免去重 key 漂移。
   */
  getValidStatuses(now: number): MonitorStatus[] {
    const result: MonitorStatus[] = []
    for (const cached of this.cache.values()) {
      if (cached.expiresAt > now) {
        result.push({
          tool: cached.data.tool,
          status: cached.data.status,
          summary: cached.data.summary,
          details: cached.data.details,
          // 使用推送入缓存的固定时间戳,而非当前时间。
          // 否则每次聚合 timestamp 都会变化,导致 emitUpdate 中
          // `${tool}|${timestamp}` 去重 key 漂移,同一 completed 事件
          // 被反复判定为"新",造成 onTaskCompleted 重复触发。
          timestamp: cached.pushedAt,
        })
      }
    }
    return result
  }

  /**
   * 清理已过期条目,避免长运行下无限增长
   */
  cleanExpired(now: number): void {
    for (const [tool, cached] of this.cache) {
      if (cached.expiresAt <= now) {
        this.cache.delete(tool)
      }
    }
  }
}
