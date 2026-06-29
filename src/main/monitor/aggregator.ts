import type { MonitorStatus, AggregatedStatus, PetState } from '@shared/types'

/**
 * StatusAggregator — 状态聚合器
 * 将多个工具的状态聚合为统一的 AggregatedStatus，确定宠物状态并构建摘要。
 *
 * 优先级: error > working > completed > idle
 */
export class StatusAggregator {
  /**
   * 聚合所有工具的状态数据
   */
  aggregate(allStatuses: MonitorStatus[]): AggregatedStatus {
    const petState = this.determinePetState(allStatuses)
    const summary = this.buildSummary(allStatuses)

    return {
      petState,
      tools: allStatuses,
      summary,
    }
  }

  /**
   * 根据各工具状态确定宠物状态
   * 优先级: error > working > completed > idle
   */
  private determinePetState(allStatuses: MonitorStatus[]): PetState {
    const hasError = allStatuses.some((s) => s.status === 'error')
    const isWorking = allStatuses.some((s) => s.status === 'working')
    const hasCompleted = allStatuses.some(
      (s) => s.status === 'completed' && Date.now() - s.timestamp < 30_000
    )

    if (hasError) return 'error'
    if (isWorking) return 'working'
    if (hasCompleted) return 'happy'
    return 'idle'
  }

  /**
   * 构建摘要文本
   */
  private buildSummary(statuses: MonitorStatus[]): string {
    if (statuses.length === 0) {
      return 'DesktopXPet 待机中'
    }

    const working = statuses.filter((s) => s.status === 'working')
    if (working.length > 0) {
      return working.map((s) => `${s.tool}: ${s.summary}`).join(' | ')
    }

    const errors = statuses.filter((s) => s.status === 'error')
    if (errors.length > 0) {
      return `⚠️ ${errors.length} 个工具出错`
    }

    const completed = statuses.filter(
      (s) => s.status === 'completed' && Date.now() - s.timestamp < 30_000
    )
    if (completed.length > 0) {
      return `✅ ${completed.map((s) => s.tool).join(', ')} 完成`
    }

    return 'DesktopXPet 待机中'
  }
}
