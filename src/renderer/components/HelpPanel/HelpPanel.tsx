import { useState } from 'react'

type HelpTab = 'basics' | 'interactions' | 'nurture' | 'shortcuts' | 'troubleshooting'

const HELP_SECTIONS: { id: HelpTab; label: string; icon: string }[] = [
  { id: 'basics', label: '基础操作', icon: '🐾' },
  { id: 'interactions', label: '宠物互动', icon: '✨' },
  { id: 'nurture', label: '养成系统', icon: '🌱' },
  { id: 'shortcuts', label: '快捷键', icon: '⌨️' },
  { id: 'troubleshooting', label: '常见问题', icon: '🔧' },
]

// 基础操作
const BASICS_ROWS: { action: string; effect: string }[] = [
  { action: '左键点击', effect: '跳跃动画' },
  { action: '右键点击', effect: '弹出菜单' },
  { action: '双击', effect: '打开仪表盘' },
  { action: '拖拽', effect: '移动宠物位置' },
  { action: '鼠标悬停', effect: '显示状态详情面板' },
  { action: '双击气泡', effect: '编辑宠物名称' },
]

// 宠物互动
const INTERACTION_ROWS: { action: string; effect: string }[] = [
  { action: '左键点击', effect: '跳跃 + 心情+3、亲密度+1（3秒冷却）' },
  { action: '悬停1.5秒', effect: '摸头 + 心情+5、亲密度+2（3秒冷却）' },
  { action: '右键喂食', effect: '吃饭 + 饱食度+20、心情+2、亲密度+1（3秒冷却）' },
]

// 养成系统
const NURTURE_VITALS: { name: string; rate: string }[] = [
  { name: '心情', rate: '0.5/分' },
  { name: '饱食度', rate: '0.5/分' },
  { name: '精力（工作时）', rate: '-0.3/分' },
]

const NURTURE_XP: { source: string; reward: string }[] = [
  { source: '工作', reward: '+1/分' },
  { source: '任务完成', reward: '+10' },
  { source: '番茄钟', reward: '+15' },
  { source: '点击', reward: '+1' },
  { source: '喂食', reward: '+3' },
]

// 快捷键
const SHORTCUT_ROWS: { key: string; action: string }[] = [
  { key: 'Ctrl+Shift+P', action: '显示/隐藏宠物' },
  { key: 'Ctrl+Shift+D', action: '打开仪表盘' },
  { key: 'Ctrl+Shift+S', action: '切换皮肤' },
]

// 常见问题
const TROUBLESHOOTING_ROWS: { problem: string; solution: string }[] = [
  { problem: '宠物不显示', solution: '检查托盘图标，按 Ctrl+Shift+P' },
  { problem: '端口冲突', solution: '自动尝试 9528/9529...' },
  { problem: '音效不播放', solution: '检查 resources/sounds/ 目录' },
  { problem: '属性归零', solution: '长时间不玩会衰减，互动恢复' },
  { problem: '状态面板不消失', solution: '鼠标移开窗口即可恢复' },
  { problem: 'GitHub 监控不工作', solution: '需要在设置中配置 token' },
]

function renderBasics() {
  return (
    <div>
      <h4>🖱️ 鼠标操作</h4>
      <table>
        <thead>
          <tr>
            <th>操作</th>
            <th>效果</th>
          </tr>
        </thead>
        <tbody>
          {BASICS_ROWS.map((row) => (
            <tr key={row.action}>
              <td>{row.action}</td>
              <td>{row.effect}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function renderInteractions() {
  return (
    <div>
      <h4>✨ 互动行为</h4>
      <table>
        <thead>
          <tr>
            <th>操作</th>
            <th>效果</th>
          </tr>
        </thead>
        <tbody>
          {INTERACTION_ROWS.map((row) => (
            <tr key={row.action}>
              <td>{row.action}</td>
              <td>{row.effect}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4>⚡ 互动优先级</h4>
      <ul>
        <li>跳跃 &gt; 吃饭 &gt; 摸头</li>
      </ul>
    </div>
  )
}

function renderNurture() {
  return (
    <div>
      <h4>🌱 四维属性</h4>
      <ul>
        <li>心情 / 饱食度 / 精力 / 亲密度</li>
      </ul>
      <h4>📉 衰减速率</h4>
      <table>
        <thead>
          <tr>
            <th>属性</th>
            <th>速率</th>
          </tr>
        </thead>
        <tbody>
          {NURTURE_VITALS.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>{row.rate}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul>
        <li>离线衰减最多计算 2 小时</li>
      </ul>
      <h4>⭐ 等级系统</h4>
      <ul>
        <li>通过工作 / 任务 / 番茄钟 / 互动获得 XP</li>
      </ul>
      <table>
        <thead>
          <tr>
            <th>来源</th>
            <th>XP 奖励</th>
          </tr>
        </thead>
        <tbody>
          {NURTURE_XP.map((row) => (
            <tr key={row.source}>
              <td>{row.source}</td>
              <td>{row.reward}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function renderShortcuts() {
  return (
    <div>
      <h4>⌨️ 全局快捷键</h4>
      <table>
        <thead>
          <tr>
            <th>快捷键</th>
            <th>功能</th>
          </tr>
        </thead>
        <tbody>
          {SHORTCUT_ROWS.map((row) => (
            <tr key={row.key}>
              <td>
                <code>{row.key}</code>
              </td>
              <td>{row.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function renderTroubleshooting() {
  return (
    <div>
      <h4>🔧 常见问题与解决方案</h4>
      <table>
        <thead>
          <tr>
            <th>问题</th>
            <th>解决方案</th>
          </tr>
        </thead>
        <tbody>
          {TROUBLESHOOTING_ROWS.map((row) => (
            <tr key={row.problem}>
              <td>{row.problem}</td>
              <td>{row.solution}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * 帮助文档面板 — 内嵌快速帮助，不依赖外部文件加载
 */
export default function HelpPanel() {
  const [activeTab, setActiveTab] = useState<HelpTab>('basics')

  const renderContent = () => {
    switch (activeTab) {
      case 'basics':
        return renderBasics()
      case 'interactions':
        return renderInteractions()
      case 'nurture':
        return renderNurture()
      case 'shortcuts':
        return renderShortcuts()
      case 'troubleshooting':
        return renderTroubleshooting()
      default:
        return null
    }
  }

  return (
    <div className="help-panel">
      <h2 className="section-title">📖 帮助文档</h2>
      <div className="help-tabs">
        {HELP_SECTIONS.map((section) => (
          <button
            key={section.id}
            className={`help-tab${activeTab === section.id ? ' active' : ''}`}
            onClick={() => setActiveTab(section.id)}
            type="button"
          >
            <span className="help-tab-icon">{section.icon}</span>
            <span className="help-tab-label">{section.label}</span>
          </button>
        ))}
      </div>
      <div className="help-content">{renderContent()}</div>
      <div className="help-footer">更多详细文档请参阅项目 docs/ 目录</div>
    </div>
  )
}
