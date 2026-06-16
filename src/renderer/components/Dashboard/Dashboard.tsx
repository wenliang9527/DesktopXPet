import { useState, useEffect } from 'react'
import Settings from '../Settings/Settings'
import SkinSelector from '../SkinSelector/SkinSelector'
import type { AggregatedStatus, MonitorStatus } from '@shared/types'

/**
 * 仪表盘窗口 — 双击宠物打开的完整仪表盘
 */
export default function Dashboard() {
  const [status, setStatus] = useState<AggregatedStatus | null>(null)

  useEffect(() => {
    // 拉取初始快照
    window.desktopXPet.getStatusSnapshot().then(setStatus)

    // 监听增量更新
    window.desktopXPet.onStatusUpdate((newStatus: any) => {
      setStatus(newStatus)
    })
  }, [])

  const getStatusColor = (s: string): string => {
    switch (s) {
      case 'working':
        return '#4CAF50'
      case 'error':
        return '#f44336'
      case 'completed':
        return '#2196F3'
      default:
        return '#9E9E9E'
    }
  }

  return (
    <div className="dashboard">
      <h1 className="dashboard-title">🐾 DesktopXPet 仪表盘</h1>

      <div className="dashboard-summary">
        <div className="summary-card">
          <div className="card-label">当前状态</div>
          <div className="card-value" style={{ color: getStatusColor(status?.petState || 'idle') }}>
            {status?.petState || 'idle'}
          </div>
        </div>
        <div className="summary-card">
          <div className="card-label">监控工具</div>
          <div className="card-value">{status?.tools?.length || 0}</div>
        </div>
      </div>

      <h2 className="section-title">工具状态</h2>
      <div className="tools-grid">
        {status?.tools?.map((tool: MonitorStatus) => (
          <div key={tool.tool} className="tool-card">
            <div className="tool-card-header">
              <span className="tool-card-name">{tool.tool}</span>
              <span
                className="tool-card-status"
                style={{ backgroundColor: getStatusColor(tool.status) }}
              >
                {tool.status}
              </span>
            </div>
            <div className="tool-card-summary">{tool.summary}</div>
            {tool.details && (
              <div className="tool-card-details">
                {Object.entries(tool.details).map(([key, value]) => (
                  <div key={key} className="detail-row">
                    <span className="detail-key">{key}:</span>
                    <span className="detail-value">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {(!status?.tools || status.tools.length === 0) && (
          <div className="empty-state">暂无监控数据，请启用插件</div>
        )}
      </div>

      <div className="dashboard-sections">
        <SkinSelector />
        <Settings />
      </div>
    </div>
  )
}
