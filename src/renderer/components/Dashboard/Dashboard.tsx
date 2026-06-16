import { useState, useEffect } from 'react'
import Settings from '../Settings/Settings'
import SkinSelector from '../SkinSelector/SkinSelector'
import type { AggregatedStatus, MonitorStatus, PetState } from '@shared/types'

interface HistoryEntry {
  time: Date
  petState: PetState
}

const STATE_HEIGHTS: Record<string, number> = {
  idle: 20,
  working: 80,
  happy: 60,
  error: 100,
  sleeping: 15
}

/**
 * 仪表盘窗口 — 双击宠物打开的完整仪表盘
 */
export default function Dashboard() {
  const [status, setStatus] = useState<AggregatedStatus | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])

  useEffect(() => {
    window.desktopXPet.getStatusSnapshot().then(setStatus)

    window.desktopXPet.onStatusUpdate((newStatus: any) => {
      setStatus(newStatus)
      if (newStatus.petState) {
        setHistory((prev) => {
          const next = [...prev, { time: new Date(), petState: newStatus.petState }]
          return next.slice(-12)
        })
      }
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

      {history.length > 0 && (
        <>
          <div className="timeline-label">状态时间线</div>
          <div className="status-timeline">
            {history.map((entry, i) => (
              <div
                key={i}
                className="timeline-bar"
                style={{
                  height: `${STATE_HEIGHTS[entry.petState] || 20}%`,
                  backgroundColor: getStatusColor(entry.petState)
                }}
                data-label={entry.time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                title={`${entry.petState} - ${entry.time.toLocaleTimeString()}`}
              />
            ))}
          </div>
        </>
      )}

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
