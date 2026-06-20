import { memo } from 'react'
import { useAppStore } from '../../stores/appStore'
import { getToolIcon, getStatusColor } from '../../shared/tool-utils'
import type { MonitorStatus } from '@shared/types'

function getStatusEmoji(s: string): string {
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

/**
 * 悬停详情面板 — 从 appStore.isHovering 控制显示
 * 由 useClickThrough 同步 hover 状态，不依赖 DOM mouseEnter
 *
 * 弹窗定位在宠物上方（bottom: 100%），如果空间不够则显示在下方
 */
function StatusDetailPopupImpl() {
  const isHovering = useAppStore((s) => s.isHovering)
  const tools = useAppStore((s) => s.tools)

  if (!isHovering || tools.length === 0) return null

  const workingCount = tools.filter((t) => t.status === 'working').length
  const errorCount = tools.filter((t) => t.status === 'error').length

  return (
    <div className="status-detail-popup">
      <div className="popup-header">
        <span>📡 工具状态</span>
        <span className="popup-count">
          {workingCount > 0 && <span className="count-working">{workingCount} 工作中</span>}
          {errorCount > 0 && <span className="count-error">{errorCount} 出错</span>}
          {workingCount === 0 && errorCount === 0 && <span className="count-idle">全部空闲</span>}
        </span>
      </div>
      <div className="popup-tools">
        {tools.map((tool: MonitorStatus) => (
          <div key={tool.tool} className="popup-tool">
            <span className="tool-icon">{getToolIcon(tool.tool)}</span>
            <span className="tool-status" style={{ color: getStatusColor(tool.status) }}>
              {getStatusEmoji(tool.status)}
            </span>
            <div className="tool-info">
              <span className="tool-name" style={{ color: getStatusColor(tool.status) }}>
                {tool.tool}
              </span>
              <span className="tool-summary">{tool.summary}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default memo(StatusDetailPopupImpl)
