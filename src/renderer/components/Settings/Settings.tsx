import { useState, useEffect, useRef } from 'react'

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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initialRef = useRef<SettingsData | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    window.desktopXPet
      .getSettings()
      .then((data) => {
        if (cancelled) return
        // store 返回的是 Partial<AppSettings>，这里转换为 SettingsData（确保字段存在）
        const settings = data as unknown as SettingsData
        setSettings(settings)
        initialRef.current = JSON.parse(JSON.stringify(settings))
      })
      .catch(() => {
        if (!cancelled) setError('加载设置失败')
      })
    return () => {
      cancelled = true
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setError(null)
    try {
      // 只发送变更的键值对，减少磁盘 IO
      const initial = initialRef.current
      if (initial) {
        await window.desktopXPet.setSettings(settings as unknown as Record<string, unknown>)
      } else {
        const changes: Record<string, unknown> = {}
        for (const section of ['pet', 'behavior', 'monitor', 'general'] as const) {
          const initSec = (initial as unknown as Record<string, Record<string, unknown>>)[section]
          const curSec = (settings as unknown as Record<string, Record<string, unknown>>)[section]
          for (const key of Object.keys(initSec)) {
            if (initSec[key] !== curSec[key]) {
              changes[`${section}.${key}`] = curSec[key]
            }
          }
        }
        if (Object.keys(changes).length > 0) {
          await window.desktopXPet.setSettings(changes)
          // 更新初始值引用
          initialRef.current = JSON.parse(JSON.stringify(settings))
        }
      }
      setSaved(true)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError('保存失败: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
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
                pet: { ...settings.pet, alwaysOnTop: e.target.checked },
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
                pet: { ...settings.pet, clickSound: e.target.checked },
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
                  sleepAfterMinutes: parseInt(e.target.value) || 15,
                },
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
                behavior: { ...settings.behavior, showNotifications: e.target.checked },
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
                behavior: { ...settings.behavior, showBubble: e.target.checked },
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
                  defaultPollInterval: (parseInt(e.target.value) || 30) * 1000,
                },
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
                general: { ...settings.general, autoStart: e.target.checked },
              })
            }
          />
        </label>
      </div>

      <button className="save-btn" onClick={handleSave} disabled={saving}>
        {saving ? ' 保存中...' : saved ? '✅ 已保存' : '💾 保存设置'}
      </button>
      {error && <div className="settings-error">{error}</div>}
    </div>
  )
}
