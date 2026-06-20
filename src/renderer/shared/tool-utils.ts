/**
 * 工具图标和状态工具函数 — 供 Dashboard、StatusBubble、StatusDetailPopup 共享
 */

export const TOOL_ICONS: Record<string, string> = {
  System: '🖥️',
  GitHub: '🐙',
  Ollama: '🤖',
  'claude-code': '🧠',
  claude: '🧠',
  cursor: '📝',
  trae: '🚀',
  vscode: '💙',
  windsurf: '🏄',
  opencode: '⚡',
  copilot: '🤖',
  chatgpt: '💬',
  gemini: '💎',
  aider: '🤝',
  continue: '▶️',
  cline: '📐',
  roo: '🦘',
  default: '🔧',
}

export function getToolIcon(name: string): string {
  if (TOOL_ICONS[name]) return TOOL_ICONS[name]
  const lower = name.toLowerCase()
  for (const [key, icon] of Object.entries(TOOL_ICONS)) {
    if (lower.includes(key.toLowerCase())) return icon
  }
  return TOOL_ICONS.default
}

export function getStatusColor(s: string): string {
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

export function getStatusLabel(s: string): string {
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
