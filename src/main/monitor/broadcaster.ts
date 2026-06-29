import { createLogger } from '../utils/logger'
const log = createLogger('StatusBroadcaster')
import type { AggregatedStatus } from '@shared/types'

// 强制同步间隔（毫秒）
const SYNC_INTERVAL_MS = 30_000

/**
 * StatusBroadcaster — 状态广播器
 * 负责状态变化检测、广播决策与强制同步（兜底机制）。
 *
 * 广播策略：
 *   - 与上次状态对比，未变化则跳过广播以减少 IPC 与 React 重渲染
 *   - working 状态下 summary 变化仍会广播，保证用户看到最新信息
 *   - 每 30 秒强制同步一次当前状态，保证渲染进程状态最终一致
 */
export class StatusBroadcaster {
  private latestStatus: AggregatedStatus | null = null
  // 上次广播时间戳，用于强制同步间隔控制
  private lastBroadcastTime = 0
  private onUpdate?: (status: AggregatedStatus) => void
  // 定期强制同步定时器（兜底：保证渲染进程状态最终一致）
  private syncTimer: ReturnType<typeof setInterval> | null = null

  constructor(onUpdate?: (status: AggregatedStatus) => void) {
    this.onUpdate = onUpdate
  }

  /**
   * 广播决策：根据状态变化与是否有新 completed 事件决定是否广播。
   *
   * @returns 是否实际执行了广播
   */
  broadcast(status: AggregatedStatus, hasNewCompleted: boolean, now: number): boolean {
    if (
      this.latestStatus &&
      !hasNewCompleted &&
      !this.hasStateChanged(this.latestStatus, status)
    ) {
      log.debug(
        `emitUpdate skipped (no change): petState=${status.petState}, tools=[${status.tools.map((t) => `${t.tool}=${t.status}`).join(',')}]`
      )
      this.latestStatus = status
      return false
    }

    this.latestStatus = status
    this.lastBroadcastTime = now
    log.info(
      `Status broadcast: petState=${status.petState}, tools=[${status.tools.map((t) => `${t.tool}=${t.status}`).join(',')}], summary="${status.summary}", newCompleted=${hasNewCompleted}`
    )
    this.onUpdate?.(status)
    return true
  }

  /**
   * 启动定期强制同步定时器（每 30 秒广播一次当前状态，保证渲染进程最终一致）
   */
  startSyncTimer(): void {
    this.syncTimer = setInterval(() => {
      this.forceSync()
    }, SYNC_INTERVAL_MS)
  }

  /**
   * 停止强制同步定时器
   */
  stopSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }

  /**
   * 强制同步当前状态到渲染进程（兜底机制）
   * 如果距离上次广播超过 30 秒，重新广播当前状态。
   */
  private forceSync(): void {
    if (!this.latestStatus) return
    const now = Date.now()
    // 距离上次广播超过 30 秒才强制同步，避免与正常广播重复
    if (now - this.lastBroadcastTime >= SYNC_INTERVAL_MS) {
      log.debug('Force sync: re-broadcasting current status')
      this.onUpdate?.(this.latestStatus)
      this.lastBroadcastTime = now
    }
  }

  /**
   * 获取当前快照（不触发新的 fetch）
   */
  getSnapshot(): AggregatedStatus {
    if (this.latestStatus) {
      return this.latestStatus
    }
    return {
      petState: 'idle',
      tools: [],
      summary: 'DesktopXPet 待机中',
    }
  }

  /**
   * 状态变化检测：按 tool 名称匹配比较（而非索引），避免数组顺序变化导致误判
   *
   * 注意：去重逻辑基于主进程侧的 latestStatus，但渲染进程的 petState 可能被
   * 其他操作（点击、唤醒等）修改为不同值。因此去重条件要宽松：
   * - 只在所有工具都是 idle 且 petState 没变时才跳过广播
   * - working 状态下始终广播（summary 可能变化，且需要保证渲染进程状态一致）
   */
  private hasStateChanged(prev: AggregatedStatus, status: AggregatedStatus): boolean {
    const stateChanged = prev.petState !== status.petState

    // 按名称构建 map 比较，避免索引错位
    const prevMap = new Map(prev.tools.map((t) => [t.tool, t]))

    const toolsChanged =
      prevMap.size !== status.tools.length ||
      status.tools.some((t) => {
        const prevTool = prevMap.get(t.tool)
        return !prevTool || prevTool.status !== t.status
      })

    // working 状态下，summary 变化也要广播（用户能看到当前编辑的文件/行号）
    const summaryChanged =
      status.petState === 'working' &&
      status.tools.some((t) => {
        const prevTool = prevMap.get(t.tool)
        return prevTool && prevTool.status === 'working' && prevTool.summary !== t.summary
      })

    if (stateChanged || toolsChanged || summaryChanged) {
      log.debug(
        `emitUpdate broadcast reason: stateChanged=${stateChanged}, toolsChanged=${toolsChanged}, summaryChanged=${summaryChanged}`
      )
      return true
    }
    return false
  }
}
