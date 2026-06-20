import { createLogger } from '../utils/logger'
const log = createLogger('GitHubPlugin')
import type { MonitorPlugin, MonitorStatus } from '@shared/types'

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

    try {
      const today = new Date().toISOString().split('T')[0]

      // 获取今日 events
      const eventsResp = await fetch(
        `https://api.github.com/users/${this.username}/events?per_page=20`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'DesktopXPet',
          },
        }
      )

      let todayCommits = 0
      if (eventsResp.ok) {
        const events = (await eventsResp.json()) as any[]
        todayCommits = events.filter(
          (e: any) => e.type === 'PushEvent' && e.created_at?.startsWith(today)
        ).length
      }

      // 获取开放 PR
      const prsResp = await fetch(
        `https://api.github.com/search/issues?q=is:pr+author:${this.username}+is:open`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'DesktopXPet',
          },
        }
      )

      let openPRs = 0
      if (prsResp.ok) {
        const prData = (await prsResp.json()) as any
        openPRs = prData.total_count || 0
      }

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
