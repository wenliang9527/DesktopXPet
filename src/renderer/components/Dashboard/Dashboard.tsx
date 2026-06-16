import { useState, useEffect, useRef } from 'react'
import Settings from '../Settings/Settings'
import SkinSelector from '../SkinSelector/SkinSelector'
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
  sleeping: 15
}

const TOOL_ICONS: Record<string, string> = {
  System: '🖥️',
  GitHub: '🐙',
  Ollama: '🤖',
  'claude-code': '🧠',
  cursor: '📝',
  opencode: '⚡',
  copilot: '🤖',
  'chatgpt': '💬',
  default: '🔧'
}

function getToolIcon(name: string): string {
  if (TOOL_ICONS[name]) return TOOL_ICONS[name]
  const lower = name.toLowerCase()
  for (const [key, icon] of Object.entries(TOOL_ICONS)) {
    if (lower.includes(key.toLowerCase())) return icon
  }
  return TOOL_ICONS.default
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

  useEffect(() => {
    window.desktopXPet.getStatusSnapshot().then((snapshot: any) => {
      setStatus(snapshot)
      // 用快照初始化已知工具
      if (snapshot?.tools) {
        for (const tool of snapshot.tools) {
          const existing = toolsRef.current.get(tool.tool)
          if (!existing) {
            toolsRef.current.set(tool.tool, {
              name: tool.tool,
              status: tool.status,
              summary: tool.summary,
              lastSeen: new Date(),
              source: BUILTIN_PLUGINS.includes(tool.tool) ? 'plugin' : 'push',
              icon: getToolIcon(tool.tool)
            })
          }
        }
        setConnectedTools(new Map(toolsRef.current))
      }
    })

    let lastUpdate = 0
    window.desktopXPet.onStatusUpdate((newStatus: any) => {
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

      // 累积所有出现过的工具
      if (newStatus?.tools) {
        for (const tool of newStatus.tools) {
          const existing = toolsRef.current.get(tool.tool)
          toolsRef.current.set(tool.tool, {
            name: tool.tool,
            status: tool.status,
            summary: tool.summary,
            lastSeen: new Date(),
            source: existing?.source ?? (BUILTIN_PLUGINS.includes(tool.tool) ? 'plugin' : 'push'),
            icon: getToolIcon(tool.tool)
          })
        }
        setConnectedTools(new Map(toolsRef.current))
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

  const getStatusLabel = (s: string): string => {
    switch (s) {
      case 'working':
        return '工作中'
      case 'error':
        return '出错'
      case 'completed':
        return '已完成'
      default:
        return '空闲'
    }
  }

  const pluginTools = Array.from(connectedTools.values()).filter(t => t.source === 'plugin')
  const pushTools = Array.from(connectedTools.values()).filter(t => t.source === 'push')

  return (
    <div className="dashboard">
      <h1 className="dashboard-title">🐾 DesktopXPet 仪表盘</h1>

      <div className="dashboard-summary">
        <div className="summary-card">
          <div className="card-label">宠物状态</div>
          <div className="card-value" style={{ color: getStatusColor(status?.petState || 'idle') }}>
            {status?.petState || 'idle'}
          </div>
        </div>
        <div className="summary-card">
          <div className="card-label">内置插件</div>
          <div className="card-value">{pluginTools.length}</div>
        </div>
        <div className="summary-card">
          <div className="card-label">外部接入</div>
          <div className="card-value">{pushTools.length}</div>
        </div>
        <div className="summary-card">
          <div className="card-label">总计工具</div>
          <div className="card-value">{connectedTools.size}</div>
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
          <div className="empty-state">
            暂无工具接入。通过 HTTP API 推送状态或启用内置插件。
          </div>
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
                  <span className="tool-card-name">{getToolIcon(tool.tool)} {tool.tool}</span>
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
        <SkinSelector />
        <Settings />
      </div>
    </div>
  )
}
