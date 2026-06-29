import { memo, useEffect, useMemo } from 'react'
import { useAppStore } from '../../stores/appStore'
import { getToolIcon } from '../../shared/tool-utils'

const STATE_LABELS: Record<string, string> = {
  idle: '待机中',
  working: '工作中',
  happy: '开心',
  error: '出错',
  sleeping: '睡眠',
  waking: '唤醒',
}

const STATE_COLORS: Record<string, string> = {
  idle: 'rgba(158, 158, 158, 0.3)',
  working: 'rgba(76, 175, 80, 0.3)',
  happy: 'rgba(255, 193, 7, 0.3)',
  error: 'rgba(244, 67, 54, 0.3)',
  sleeping: 'rgba(103, 58, 183, 0.3)',
  waking: 'rgba(33, 150, 243, 0.3)',
}

const STATE_TEXT_COLORS: Record<string, string> = {
  idle: '#9E9E9E',
  working: '#81C784',
  happy: '#FFD54F',
  error: '#EF5350',
  sleeping: '#B39DDB',
  waking: '#64B5F6',
}

function StatusBubbleImpl() {
  const tools = useAppStore((s) => s.tools)
  const petState = useAppStore((s) => s.petState)
  const petName = useAppStore((s) => s.petName)
  const nurtureState = useAppStore((s) => s.nurtureState)
  const interactionMessage = useAppStore((s) => s.interactionMessage)
  const clearInteractionMessage = useAppStore((s) => s.clearInteractionMessage)
  const isWindowHovered = useAppStore((s) => s.isWindowHovered)
  const showBubble = useAppStore((s) => s.showBubble)

  // 互动消息 3 秒后自动清除
  useEffect(() => {
    if (!interactionMessage) return
    const timer = setTimeout(() => clearInteractionMessage(), 3000)
    return () => clearTimeout(timer)
  }, [interactionMessage, clearInteractionMessage])

  const nurtureWarnings = useMemo(() => {
    const warnings: string[] = []
    if (nurtureState) {
      if (nurtureState.vitals.satiety < 20) warnings.push('饿了~')
      if (nurtureState.vitals.mood < 20) warnings.push('不开心...')
      if (nurtureState.vitals.energy < 20) warnings.push('好累...')
    }
    return warnings
  }, [nurtureState])

  const workingTools = useMemo(
    () => tools.filter((t) => t.status === 'working'),
    [tools]
  )
  const errorTools = useMemo(
    () => tools.filter((t) => t.status === 'error'),
    [tools]
  )
  const hasMultiple = workingTools.length > 1

  if (!showBubble) {
    return null
  }

  return (
    <div className="status-bubble" style={isWindowHovered ? { visibility: 'hidden' } : undefined}>
      {/* 状态徽章 */}
      <div
        className="bubble-badge"
        style={{
          backgroundColor: STATE_COLORS[petState] || STATE_COLORS.idle,
          color: STATE_TEXT_COLORS[petState] || STATE_TEXT_COLORS.idle,
        }}
      >
        {STATE_LABELS[petState] || '待机中'}
      </div>

      {hasMultiple && workingTools.length > 1 && (
        <div className="bubble-badge" style={{ marginLeft: '6px' }}>
          {workingTools.length} 个工具并行中
        </div>
      )}

      {workingTools.length > 0 ? (
        <div className="bubble-tools">
          {workingTools.slice(0, 3).map((tool) => (
            <div key={tool.tool} className="bubble-tool-row">
              <span className="bubble-tool-icon">{getToolIcon(tool.tool)}</span>
              <span className="bubble-tool-name">{tool.tool}</span>
              <span className="bubble-tool-summary">{tool.summary}</span>
            </div>
          ))}
          {workingTools.length > 3 && (
            <div className="bubble-tool-more">+{workingTools.length - 3} 更多...</div>
          )}
        </div>
      ) : errorTools.length > 0 ? (
        <div className="bubble-errors">
          {errorTools.map((tool) => (
            <div key={tool.tool} className="bubble-error-row">
              <span className="bubble-tool-icon">{getToolIcon(tool.tool)}</span>
              <span className="bubble-tool-name">{tool.tool}</span>
              <span className="bubble-tool-summary"> {tool.summary}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="bubble-summary">{petName} 待机中</div>
      )}

      {interactionMessage && (
        <div className="bubble-interaction-message">{interactionMessage}</div>
      )}

      {nurtureWarnings.length > 0 && (
        <div className="bubble-nurture-warnings">
          {nurtureWarnings.map((w, i) => (
            <span key={i} className="nurture-warning">{w}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export default memo(StatusBubbleImpl)
