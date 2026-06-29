import os from 'os'
import { createLogger } from '../utils/logger'
const log = createLogger('SystemMonitorPlugin')
import type { MonitorPlugin, MonitorStatus } from '@shared/types'

/**
 * 系统资源监控插件 — CPU / 内存
 */
export class SystemMonitorPlugin implements MonitorPlugin {
  name = 'system'
  icon = '🖥️'
  pollInterval = 10_000 // 10秒

  private lastCpuInfo: { idle: number; total: number } | null = null

  async fetchStatus(): Promise<MonitorStatus> {
    try {
      const cpuPercent = await this.getCpuUsage()
      const memPercent = Math.round((1 - os.freemem() / os.totalmem()) * 100)

      const isHighLoad = cpuPercent > 80 || memPercent > 90

      return {
        tool: 'System',
        status: isHighLoad ? 'working' : 'idle',
        summary: `CPU ${cpuPercent}% | 内存 ${memPercent}%`,
        details: {
          cpu: cpuPercent,
          memory: memPercent,
          uptime: os.uptime(),
          platform: os.platform(),
          arch: os.arch(),
        },
        timestamp: Date.now(),
      }
    } catch (err) {
      log.warn('System monitor fetch failed:', err)
      return {
        tool: 'System',
        status: 'error',
        summary: '系统监控获取失败',
        timestamp: Date.now(),
      }
    }
  }

  /**
   * 计算 CPU 使用率（两次采样差值）
   * 首次采样只记录基线并返回 0 占位值,下次 poll 才能计算出差值,避免阻塞 1 秒
   */
  private async getCpuUsage(): Promise<number> {
    const cpus = os.cpus()
    let idle = 0
    let total = 0

    for (const cpu of cpus) {
      idle += cpu.times.idle
      total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq
    }

    if (this.lastCpuInfo) {
      const idleDiff = idle - this.lastCpuInfo.idle
      const totalDiff = total - this.lastCpuInfo.total
      this.lastCpuInfo = { idle, total }
      return totalDiff > 0 ? Math.round((1 - idleDiff / totalDiff) * 100) : 0
    }

    // 首次采样:只记录基线,返回 0(下次 poll 才有差值)
    this.lastCpuInfo = { idle, total }
    return 0
  }

  async dispose(): Promise<void> {
    this.lastCpuInfo = null
  }
}
