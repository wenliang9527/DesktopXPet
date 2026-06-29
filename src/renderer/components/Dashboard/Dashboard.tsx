import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Settings from '../Settings/Settings'
import SkinSelector from '../SkinSelector/SkinSelector'
import PomodoroTimer from '../PomodoroTimer/PomodoroTimer'
import HelpPanel from '../HelpPanel/HelpPanel'
import { useAppStore } from '../../stores/appStore'
import { getToolIcon, getStatusColor, getStatusLabel } from '../../shared/tool-utils'
import type { AggregatedStatus, MonitorStatus, PetState } from '@shared/types'

interface HistoryEntry {
  time: Date
  petState: PetState
}

interface ConnectedTool {
  name: string
  status: MonitorStatus['status']
  summary: string
  lastSeen: Date
  source: 'plugin' | 'push'
  icon: string
}

const STATE_HEIGHTS: Record<string, number> = {
  idle: 20,
  working: 80,
  happy: 60,
  error: 100,
  sleeping: 15,
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 5) return '刚刚'
  if (seconds < 60) return `${seconds}秒前`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`
  return `${Math.floor(seconds / 86400)}天前`
}

const BUILTIN_PLUGINS = ['System', 'GitHub', 'Ollama']

export default function Dashboard() {
  const [status, setStatus] = useState<AggregatedStatus | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [connectedTools, setConnectedTools] = useState<Map<string, ConnectedTool>>(new Map())
  const toolsRef = useRef<Map<string, ConnectedTool>>(new Map())

  // 宠物名称编辑
  const petName = useAppStore((s) => s.petName)
  const setPetName = useAppStore((s) => s.setPetName)
  const persistPetName = useAppStore((s) => s.persistPetName)
  const nurtureState = useAppStore((s) => s.nurtureState)
  const displayState = useAppStore((s) => s.displayState)
  const unlockedStates = useAppStore((s) => s.unlockedStates)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  const handleEditName = useCallback(() => {
    setNameInput(petName)
    setEditingName(true)
    setTimeout(() => nameInputRef.current?.focus(), 0)
  }, [petName])

  const handleSaveName = useCallback(() => {
    const name = nameInput.trim()
    if (name) {
      setPetName(name)
      void persistPetName(name)
    }
    setEditingName(false)
  }, [nameInput, setPetName, persistPetName])

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSaveName()
      if (e.key === 'Escape') setEditingName(false)
    },
    [handleSaveName]
  )

  useEffect(() => {
    let cancelled = false
    let lastUpdate = 0
    const cleanup = window.desktopXPet.onStatusUpdate((newStatus: AggregatedStatus) => {
      if (cancelled) return
      const ts = Date.now()
      if (ts - lastUpdate < 500) return
      lastUpdate = ts
      setStatus(newStatus)

      if (newStatus.petState) {
        setHistory((prev) => {
          const next = [...prev, { time: new Date(), petState: newStatus.petState }]
          return next.slice(-12)
        })
      }

      // 累积当前活跃的工具
      if (newStatus?.tools) {
        // 移除不再上报的工具，防止 Map 无界增长
        const newToolNames = new Set(newStatus.tools.map((t) => t.tool))
        for (const key of toolsRef.current.keys()) {
          if (!newToolNames.has(key)) {
            toolsRef.current.delete(key)
          }
        }
        for (const tool of newStatus.tools) {
          const existing = toolsRef.current.get(tool.tool)
          toolsRef.current.set(tool.tool, {
            name: tool.tool,
            status: tool.status,
            summary: tool.summary,
            lastSeen: new Date(),
            source: existing?.source ?? (BUILTIN_PLUGINS.includes(tool.tool) ? 'plugin' : 'push'),
            icon: getToolIcon(tool.tool),
          })
        }
        setConnectedTools(new Map(toolsRef.current))
      }
    })

    window.desktopXPet
      .getStatusSnapshot()
      .then((snapshot: AggregatedStatus | null) => {
        if (cancelled || !snapshot) return
        setStatus(snapshot)
        // 用快照初始化已知工具
        if (snapshot.tools) {
          for (const tool of snapshot.tools) {
            const existing = toolsRef.current.get(tool.tool)
            if (!existing) {
              toolsRef.current.set(tool.tool, {
                name: tool.tool,
                status: tool.status,
                summary: tool.summary,
                lastSeen: new Date(),
                source: BUILTIN_PLUGINS.includes(tool.tool) ? 'plugin' : 'push',
                icon: getToolIcon(tool.tool),
              })
            }
          }
          setConnectedTools(new Map(toolsRef.current))
        }
      })
      .catch(() => {
        // 忽略快照获取失败
      })

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])

  const pluginTools = useMemo(
    () => Array.from(connectedTools.values()).filter((t) => t.source === 'plugin'),
    [connectedTools]
  )
  const pushTools = useMemo(
    () => Array.from(connectedTools.values()).filter((t) => t.source === 'push'),
    [connectedTools]
  )

  const allTools = useMemo(() => Array.from(connectedTools.values()), [connectedTools])
  const workingTools = useMemo(
    () => allTools.filter((t) => t.status === 'working'),
    [allTools]
  )
  const errorTools = useMemo(
    () => allTools.filter((t) => t.status === 'error'),
    [allTools]
  )

  return (
    <div className="dashboard">
      <h1 className="dashboard-title">🐾 {petName} 仪表盘</h1>

      <div className="dashboard-summary">
        <div className="summary-card">
          <div className="card-label">宠物状态</div>
          <div className="card-value" style={{ color: getStatusColor(status?.petState || 'idle') }}>
            {status?.petState || 'idle'}
          </div>
        </div>
        <div className="summary-card">
          <div className="card-label">工作中</div>
          <div
            className="card-value"
            style={{ color: workingTools.length > 0 ? '#4CAF50' : '#9E9E9E' }}
          >
            {workingTools.length}
          </div>
        </div>
        <div className="summary-card">
          <div className="card-label">出错</div>
          <div
            className="card-value"
            style={{ color: errorTools.length > 0 ? '#f44336' : '#9E9E9E' }}
          >
            {errorTools.length}
          </div>
        </div>
        <div className="summary-card">
          <div className="card-label">总计工具</div>
          <div className="card-value">{connectedTools.size}</div>
        </div>
      </div>

      {/* 宠物名称 */}
      <div className="pet-name-section">
        <h2 className="section-title">🐾 宠物名称</h2>
        <div className="pet-name-row">
          {editingName ? (
            <>
              <input
                ref={nameInputRef}
                className="pet-name-input"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={handleNameKeyDown}
              />
              <button className="pet-name-save-btn" onClick={handleSaveName}>
                保存
              </button>
              <button className="pet-name-cancel-btn" onClick={() => setEditingName(false)}>
                取消
              </button>
            </>
          ) : (
            <>
              <span className="pet-name-display">{petName}</span>
              <button className="pet-name-edit-btn" onClick={handleEditName}>
                编辑
              </button>
            </>
          )}
        </div>
      </div>

      {/* 养成面板 */}
      {nurtureState && (
        <div className="nurture-panel">
          <h2 className="section-title">🌟 养成状态</h2>
          <div className="nurture-level-row">
            <span className="nurture-level">Lv.{nurtureState.growth.level}</span>
            <div className="nurture-xp-bar">
              <div
                className="nurture-xp-fill"
                style={{ width: `${(nurtureState.growth.xp / nurtureState.growth.xpToNextLevel) * 100}%` }}
              />
            </div>
            <span className="nurture-xp-text">
              {nurtureState.growth.xp}/{nurtureState.growth.xpToNextLevel} XP
            </span>
          </div>
          <div className="nurture-vitals">
            {[
              { label: '心情', value: nurtureState.vitals.mood, color: '#E91E63' },
              { label: '饱食', value: nurtureState.vitals.satiety, color: '#FF9800' },
              { label: '精力', value: nurtureState.vitals.energy, color: '#4CAF50' },
              { label: '亲密', value: nurtureState.vitals.intimacy, color: '#9C27B0' },
            ].map((v) => (
              <div key={v.label} className="nurture-vital-row">
                <span className="nurture-vital-label">{v.label}</span>
                <div className="nurture-vital-bar">
                  <div
                    className="nurture-vital-fill"
                    style={{ width: `${v.value}%`, backgroundColor: v.color }}
                  />
                </div>
                <span className="nurture-vital-value">{Math.round(v.value)}</span>
              </div>
            ))}
          </div>
          <div className="nurture-stats">
            <span>完成任务: {nurtureState.growth.completedTasks}</span>
            <span>番茄钟: {nurtureState.growth.pomodorosCompleted}</span>
            <span>工作时长: {Math.round(nurtureState.growth.totalWorkMinutes)}分钟</span>
          </div>
          {displayState && (
            <div className="nurture-stats">
              <span>显示状态: {displayState.state}</span>
              {displayState.source && (
                <span>来源: {displayState.source}</span>
              )}
              {displayState.reason && <span>原因: {displayState.reason}</span>}
            </div>
          )}
          {unlockedStates.length > 0 && (
            <div className="nurture-stats">
              <span>已解锁: {unlockedStates.join(', ')}</span>
            </div>
          )}
        </div>
      )}

      {/* 并行工作概览 */}
      {workingTools.length > 0 && (
        <div className="parallel-overview">
          <div className="parallel-header">⚡ 并行工作中 ({workingTools.length})</div>
          <div className="parallel-tools">
            {workingTools.map((tool) => (
              <div key={tool.name} className="parallel-tool-chip">
                <span>{tool.icon}</span>
                <span className="parallel-tool-name">{tool.name}</span>
                <span className="parallel-tool-summary">{tool.summary}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <>
          <div className="timeline-label">状态时间线</div>
          <div className="status-timeline">
            {history.map((entry, i) => (
              <div
                key={`${entry.time.getTime()}-${i}`}
                className="timeline-bar"
                style={{
                  height: `${STATE_HEIGHTS[entry.petState] || 20}%`,
                  backgroundColor: getStatusColor(entry.petState),
                }}
                data-label={entry.time.toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
                title={`${entry.petState} - ${entry.time.toLocaleTimeString()}`}
              />
            ))}
          </div>
        </>
      )}

      {/* 已接入工具 */}
      <h2 className="section-title">📡 已接入工具</h2>
      <div className="connected-tools">
        {pluginTools.length > 0 && (
          <div className="tool-group">
            <div className="tool-group-label">内置插件</div>
            {pluginTools.map((tool) => (
              <div key={tool.name} className="connected-tool-row">
                <span className="connected-tool-icon">{tool.icon}</span>
                <div className="connected-tool-info">
                  <div className="connected-tool-name">{tool.name}</div>
                  <div className="connected-tool-summary">{tool.summary}</div>
                </div>
                <div className="connected-tool-right">
                  <span
                    className="connected-tool-status"
                    style={{ backgroundColor: getStatusColor(tool.status) }}
                  >
                    {getStatusLabel(tool.status)}
                  </span>
                  <span className="connected-tool-time">{timeAgo(tool.lastSeen)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {pushTools.length > 0 && (
          <div className="tool-group">
            <div className="tool-group-label">外部工具（HTTP Push）</div>
            {pushTools.map((tool) => (
              <div key={tool.name} className="connected-tool-row">
                <span className="connected-tool-icon">{tool.icon}</span>
                <div className="connected-tool-info">
                  <div className="connected-tool-name">{tool.name}</div>
                  <div className="connected-tool-summary">{tool.summary}</div>
                </div>
                <div className="connected-tool-right">
                  <span
                    className="connected-tool-status"
                    style={{ backgroundColor: getStatusColor(tool.status) }}
                  >
                    {getStatusLabel(tool.status)}
                  </span>
                  <span className="connected-tool-time">{timeAgo(tool.lastSeen)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {connectedTools.size === 0 && (
          <div className="empty-state">暂无工具接入。通过 HTTP API 推送状态或启用内置插件。</div>
        )}
      </div>

      {/* 实时工具详情 */}
      {status?.tools && status.tools.length > 0 && (
        <>
          <h2 className="section-title">📊 实时状态详情</h2>
          <div className="tools-grid">
            {status.tools.map((tool: MonitorStatus) => (
              <div key={tool.tool} className="tool-card">
                <div className="tool-card-header">
                  <span className="tool-card-name">
                    {getToolIcon(tool.tool)} {tool.tool}
                  </span>
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
          </div>
        </>
      )}

      <div className="dashboard-sections">
        <PomodoroTimer />
        <SkinSelector />
        <Settings />
        <HelpPanel />
      </div>
    </div>
  )
}
