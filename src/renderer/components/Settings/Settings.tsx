import { useState, useEffect } from 'react'

interface SettingsData {
  pet: { scale: number; alwaysOnTop: boolean; clickSound: boolean }
  behavior: { sleepAfterMinutes: number; showNotifications: boolean; showBubble: boolean }
  monitor: { defaultPollInterval: number }
  general: { autoStart: boolean; language: string }
}

/**
 * 设置面板 — 完整的设置界面
 */
export default function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    const data = await window.desktopXPet.getSettings()
    setSettings(data)
  }

  const handleSave = async () => {
    if (!settings) return
    await window.desktopXPet.setSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!settings) return <div className="loading">加载中...</div>

  return (
    <div className="settings-panel">
      <h2 className="section-title">⚙️ 设置</h2>

      <div className="settings-section">
        <h3>🐾 宠物</h3>
        <label className="setting-row">
          <span>始终置顶</span>
          <input
            type="checkbox"
            checked={settings.pet.alwaysOnTop}
            onChange={(e) =>
              setSettings({
                ...settings,
                pet: { ...settings.pet, alwaysOnTop: e.target.checked }
              })
            }
          />
        </label>
        <label className="setting-row">
          <span>点击音效</span>
          <input
            type="checkbox"
            checked={settings.pet.clickSound}
            onChange={(e) =>
              setSettings({
                ...settings,
                pet: { ...settings.pet, clickSound: e.target.checked }
              })
            }
          />
        </label>
      </div>

      <div className="settings-section">
        <h3>💤 行为</h3>
        <label className="setting-row">
          <span>闲置睡眠 (分钟)</span>
          <input
            type="number"
            min="1"
            max="60"
            value={settings.behavior.sleepAfterMinutes}
            onChange={(e) =>
              setSettings({
                ...settings,
                behavior: {
                  ...settings.behavior,
                  sleepAfterMinutes: parseInt(e.target.value) || 15
                }
              })
            }
          />
        </label>
        <label className="setting-row">
          <span>系统通知</span>
          <input
            type="checkbox"
            checked={settings.behavior.showNotifications}
            onChange={(e) =>
              setSettings({
                ...settings,
                behavior: { ...settings.behavior, showNotifications: e.target.checked }
              })
            }
          />
        </label>
        <label className="setting-row">
          <span>状态气泡</span>
          <input
            type="checkbox"
            checked={settings.behavior.showBubble}
            onChange={(e) =>
              setSettings({
                ...settings,
                behavior: { ...settings.behavior, showBubble: e.target.checked }
              })
            }
          />
        </label>
      </div>

      <div className="settings-section">
        <h3>📊 监控</h3>
        <label className="setting-row">
          <span>默认轮询间隔 (秒)</span>
          <input
            type="number"
            min="5"
            max="300"
            value={settings.monitor.defaultPollInterval / 1000}
            onChange={(e) =>
              setSettings({
                ...settings,
                monitor: {
                  ...settings.monitor,
                  defaultPollInterval: (parseInt(e.target.value) || 30) * 1000
                }
              })
            }
          />
        </label>
      </div>

      <div className="settings-section">
        <h3>🔧 通用</h3>
        <label className="setting-row">
          <span>开机自启</span>
          <input
            type="checkbox"
            checked={settings.general.autoStart}
            onChange={(e) =>
              setSettings({
                ...settings,
                general: { ...settings.general, autoStart: e.target.checked }
              })
            }
          />
        </label>
      </div>

      <button className="save-btn" onClick={handleSave}>
        {saved ? '✅ 已保存' : '💾 保存设置'}
      </button>
    </div>
  )
}
