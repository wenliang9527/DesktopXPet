import { useRef, useEffect, useState, useCallback } from 'react'
import type { AggregatedStatus, MonitorStatus } from '@shared/types'

/**
 * 悬停详情面板 — hover 时显示各工具详细状态
 */
export default function StatusDetailPopup() {
  const [visible, setVisible] = useState(false)
  const [status, setStatus] = useState<AggregatedStatus | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    setVisible(false)
  }, [])

  useEffect(() => {
    if (visible) {
      const interval = setInterval(async () => {
        const snapshot = await window.desktopXPet.getStatusSnapshot()
        setStatus(snapshot)
      }, 2000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [visible])

  if (!visible || !status) return null

  const getStatusEmoji = (s: string): string => {
    switch (s) {
      case 'working':
        return '🔄'
      case 'error':
        return '❌'
      case 'completed':
        return '✅'
      default:
        return '💤'
    }
  }

  return (
    <div
      className="status-detail-popup"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={handleMouseLeave}
    >
      <div className="popup-header">DesktopXPet 状态详情</div>
      {status.tools.length === 0 ? (
        <div className="popup-empty">暂无监控数据</div>
      ) : (
        <div className="popup-tools">
          {status.tools.map((tool: MonitorStatus) => (
            <div key={tool.tool} className="popup-tool">
              <span className="tool-status">{getStatusEmoji(tool.status)}</span>
              <span className="tool-name">{tool.tool}</span>
              <span className="tool-summary">{tool.summary}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
