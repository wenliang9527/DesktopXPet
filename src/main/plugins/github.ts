import { createLogger } from '../utils/logger'
const log = createLogger('GitHubPlugin')
import type { MonitorPlugin, MonitorStatus } from '@shared/types'

// GitHub API 响应类型定义
interface GitHubEvent {
  type: string
  created_at?: string
}
interface GitHubSearchResponse {
  total_count: number
}

/**
 * GitHub 活动监控插件
 * 通过 GitHub REST API 获取 commits/PR/issues
 */
export class GitHubPlugin implements MonitorPlugin {
  name = 'github'
  icon = '🐙'
  pollInterval = 300_000 // 5分钟（API 限频考虑）

  private token: string = ''
  private username: string = ''

  async init(config: Record<string, any>): Promise<void> {
    this.token = config.token || ''
    this.username = config.username || ''
  }

  async fetchStatus(): Promise<MonitorStatus> {
    if (!this.token || !this.username) {
      return {
        tool: 'GitHub',
        status: 'idle',
        summary: 'GitHub 未配置',
        timestamp: Date.now(),
      }
    }

    const today = new Date().toISOString().split('T')[0]
    const headers = {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'DesktopXPet',
    }

    try {
      // 并行获取 events 和 PR，各自独立容错，一个失败不影响另一个
      const [todayCommits, openPRs] = await Promise.all([
        (async () => {
          try {
            const resp = await fetch(
              `https://api.github.com/users/${this.username}/events?per_page=20`,
              { headers, signal: AbortSignal.timeout(5000) }
            )
            if (!resp.ok) return 0
            const events = (await resp.json()) as GitHubEvent[]
            return events.filter(
              (e: GitHubEvent) => e.type === 'PushEvent' && e.created_at?.startsWith(today)
            ).length
          } catch {
            return 0
          }
        })(),
        (async () => {
          try {
            const resp = await fetch(
              `https://api.github.com/search/issues?q=is:pr+author:${this.username}+is:open`,
              { headers, signal: AbortSignal.timeout(5000) }
            )
            if (!resp.ok) return 0
            const prData = (await resp.json()) as GitHubSearchResponse
            return prData.total_count || 0
          } catch {
            return 0
          }
        })(),
      ])

      const activityScore = todayCommits + openPRs
      return {
        tool: 'GitHub',
        status: activityScore > 0 ? 'working' : 'idle',
        summary: `今日 ${todayCommits} 次提交, ${openPRs} 个开放 PR`,
        details: { commits: todayCommits, openPRs },
        timestamp: Date.now(),
      }
    } catch (err) {
      log.warn('GitHub plugin fetch failed:', err)
      return {
        tool: 'GitHub',
        status: 'error',
        summary: 'GitHub API 请求失败',
        timestamp: Date.now(),
      }
    }
  }

  async dispose(): Promise<void> {
    // 无需清理
  }
}
