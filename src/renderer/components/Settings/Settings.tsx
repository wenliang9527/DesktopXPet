import { useState, useEffect, useRef } from 'react'
import type { UnlockConfig, StateTransitionConfig } from '@shared/types'

// window.desktopXPet 扩展接口(preload 未导出新 API 前的兜底,避免修改 preload/index.ts)
interface NurtureConfigAPI {
  getUnlockConfig: () => Promise<UnlockConfig>
  setUnlockConfig: (config: UnlockConfig) => Promise<void>
  getStateTransitionConfig: () => Promise<StateTransitionConfig>
  setStateTransitionConfig: (config: StateTransitionConfig) => Promise<void>
}

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

  // 自定义皮肤目录管理
  const [skinDirs, setSkinDirs] = useState<string[]>([])
  const [skinDirsLoading, setSkinDirsLoading] = useState(true)
  const [dirAdding, setDirAdding] = useState(false)
  const [dirRemoving, setDirRemoving] = useState<string | null>(null)
  const [skinDirError, setSkinDirError] = useState<string | null>(null)

  // 养成系统配置
  const [unlockConfig, setUnlockConfigState] = useState<UnlockConfig | null>(null)
  const [transitionConfig, setTransitionConfigState] = useState<StateTransitionConfig | null>(
    null
  )
  const [nurtureError, setNurtureError] = useState<string | null>(null)
  // 自定义状态解锁等级编辑(customThresholds)
  // 标准 nurture 状态列表(与 reze manifest.states 对齐)
  const STANDARD_NURTURE_STATES = [
    'daze', 'hungry', 'tired', 'walk', 'shy', 'dance', 'run',
    'sad', 'lonely', 'excited', 'angry', 'love', 'sick', 'celebrating'
  ]
  const [thresholdDraft, setThresholdDraft] = useState<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false
    window.desktopXPet
      .getSettings()
      .then((data) => {
        if (cancelled) return
        // store 返回的是 Partial<AppSettings>，安全转换为 SettingsData（缺失字段用默认值回退）
        const settings: SettingsData = {
          pet: {
            scale: data?.pet?.scale ?? 1,
            alwaysOnTop: data?.pet?.alwaysOnTop ?? true,
            clickSound: data?.pet?.clickSound ?? true,
          },
          behavior: {
            sleepAfterMinutes: data?.behavior?.sleepAfterMinutes ?? 15,
            showNotifications: data?.behavior?.showNotifications ?? true,
            showBubble: data?.behavior?.showBubble ?? true,
          },
          monitor: {
            defaultPollInterval: data?.monitor?.defaultPollInterval ?? 10000,
          },
          general: {
            autoStart: data?.general?.autoStart ?? false,
            language: data?.general?.language ?? 'zh-CN',
          },
        }
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

  // 加载自定义皮肤目录列表
  useEffect(() => {
    let cancelled = false
    window.desktopXPet
      .listSkinDirs()
      .then((dirs) => {
        if (cancelled) return
        setSkinDirs(dirs)
      })
      .catch(() => {
        if (!cancelled) setSkinDirError('加载皮肤目录失败')
      })
      .finally(() => {
        if (!cancelled) setSkinDirsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 加载养成解锁配置与状态切换冷却配置
  useEffect(() => {
    let cancelled = false
    const api = window.desktopXPet as unknown as NurtureConfigAPI
    Promise.all([
      api.getUnlockConfig().catch(() => null),
      api.getStateTransitionConfig().catch(() => null),
    ]).then(([unlock, transition]) => {
      if (cancelled) return
      if (unlock) {
        setUnlockConfigState(unlock)
        setThresholdDraft(unlock.customThresholds ?? {})
      }
      if (transition) setTransitionConfigState(transition)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleToggleUnlock = async (enabled: boolean) => {
    if (!unlockConfig) return
    setNurtureError(null)
    try {
      const newConfig: UnlockConfig = { ...unlockConfig, enabled }
      const api = window.desktopXPet as unknown as NurtureConfigAPI
      await api.setUnlockConfig(newConfig)
      setUnlockConfigState(newConfig)
    } catch (err) {
      setNurtureError('切换解锁失败: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const handleCooldownChange = async (ms: number) => {
    setNurtureError(null)
    try {
      const clamped = Math.max(0, Math.min(30000, ms))
      const newConfig: StateTransitionConfig = { globalCooldownMs: clamped }
      const api = window.desktopXPet as unknown as NurtureConfigAPI
      await api.setStateTransitionConfig(newConfig)
      setTransitionConfigState(newConfig)
    } catch (err) {
      setNurtureError('保存冷却时间失败: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  // 保存自定义状态解锁等级
  const handleSaveThresholds = async () => {
    if (!unlockConfig) return
    setNurtureError(null)
    try {
      // 过滤掉空值和无效值,只保留 >=1 的整数
      const cleaned: Record<string, number> = {}
      for (const [name, val] of Object.entries(thresholdDraft)) {
        const n = Math.floor(Number(val))
        if (Number.isFinite(n) && n >= 1) cleaned[name] = n
      }
      const newConfig: UnlockConfig = { ...unlockConfig, customThresholds: cleaned }
      const api = window.desktopXPet as unknown as NurtureConfigAPI
      await api.setUnlockConfig(newConfig)
      setUnlockConfigState(newConfig)
      setThresholdDraft(cleaned)
    } catch (err) {
      setNurtureError('保存自定义阈值失败: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const refreshSkinDirs = async () => {
    const dirs = await window.desktopXPet.listSkinDirs()
    setSkinDirs(dirs)
  }

  const handleAddDir = async () => {
    // 渲染进程无文件夹选择对话框 API,用 prompt 兜底让用户粘贴路径
    const inputPath = window.prompt('请输入皮肤目录的绝对路径:')
    if (!inputPath || !inputPath.trim()) return
    const trimmed = inputPath.trim()
    setDirAdding(true)
    setSkinDirError(null)
    try {
      await window.desktopXPet.addSkinDir(trimmed)
      await refreshSkinDirs()
    } catch (err) {
      setSkinDirError('添加目录失败: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setDirAdding(false)
    }
  }

  const handleRemoveDir = async (dir: string) => {
    setDirRemoving(dir)
    setSkinDirError(null)
    try {
      await window.desktopXPet.removeSkinDir(dir)
      await refreshSkinDirs()
    } catch (err) {
      setSkinDirError('删除目录失败: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setDirRemoving(null)
    }
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setError(null)
    try {
      // 只发送变更的扁平 key（如 pet.scale），减少磁盘 IO，避免卡顿
      const initial = initialRef.current
      const changes: Record<string, unknown> = {}
      if (initial) {
        for (const section of ['pet', 'behavior', 'monitor', 'general'] as const) {
          const initSec = (initial as unknown as Record<string, Record<string, unknown>>)[section]
          const curSec = (settings as unknown as Record<string, Record<string, unknown>>)[section]
          if (!initSec || !curSec) continue
          for (const key of Object.keys(curSec)) {
            if (initSec[key] !== curSec[key]) {
              changes[`${section}.${key}`] = curSec[key]
            }
          }
        }
      } else {
        // 首次保存，发送全部扁平 key
        for (const section of ['pet', 'behavior', 'monitor', 'general'] as const) {
          const sec = (settings as unknown as Record<string, Record<string, unknown>>)[section]
          if (!sec) continue
          for (const key of Object.keys(sec)) {
            changes[`${section}.${key}`] = sec[key]
          }
        }
      }
      if (Object.keys(changes).length > 0) {
        await window.desktopXPet.setSettings(changes)
        // 更新初始值引用
        initialRef.current = JSON.parse(JSON.stringify(settings))
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
                  sleepAfterMinutes: parseInt(e.target.value, 10) || 15,
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
                  defaultPollInterval: (parseInt(e.target.value) || 10) * 1000,
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

      <div className="settings-section">
        <h3>📁 自定义皮肤目录</h3>
        <div className="setting-row">
          <span>添加额外的皮肤目录,应用将从这些目录加载皮肤</span>
        </div>
        {skinDirsLoading ? (
          <div className="loading">加载中...</div>
        ) : skinDirs.length === 0 ? (
          <div className="loading">暂无自定义皮肤目录</div>
        ) : (
          skinDirs.map((dir) => (
            <div className="setting-row" key={dir}>
              <span>{dir}</span>
              <button
                onClick={() => handleRemoveDir(dir)}
                disabled={dirRemoving === dir}
              >
                {dirRemoving === dir ? '⏳' : '✕'}
              </button>
            </div>
          ))
        )}
        <button className="save-btn" onClick={handleAddDir} disabled={dirAdding}>
          {dirAdding ? '⏳ 添加中...' : '➕ 添加目录'}
        </button>
        {skinDirError && <div className="settings-error">{skinDirError}</div>}
      </div>

      <div className="settings-section">
        <h3>🎮 养成系统</h3>

        <div className="setting-row">
          <span>等级解锁</span>
        </div>
        <div className="setting-row">
          <span style={{ fontSize: '12px', color: '#888' }}>
            启用后,部分宠物状态会随等级提升逐步解锁。关闭则全部解锁。
          </span>
        </div>
        <label className="setting-row">
          <span>启用等级解锁</span>
          <input
            type="checkbox"
            checked={unlockConfig?.enabled ?? false}
            disabled={!unlockConfig}
            onChange={(e) => void handleToggleUnlock(e.target.checked)}
          />
        </label>
        {unlockConfig?.enabled && (
          <div
            className="setting-row"
            style={{ flexDirection: 'column', alignItems: 'flex-start' }}
          >
            <span style={{ fontSize: '12px', color: '#888' }}>
              默认解锁阈值(参考,实际由皮肤 manifest 的 unlockLevel 决定):
            </span>
            <ul style={{ fontSize: '12px', color: '#888', margin: '4px 0 0 16px' }}>
              <li>Lv 1-2:基础状态(idle/working/happy/sleeping/error/waking)</li>
              <li>Lv 2:daze(发呆)</li>
              <li>Lv 3-5:hungry(饥饿)/tired(疲惫)/walk(走路)/shy(害羞)/dance(跳舞)/run(跑步)</li>
              <li>Lv 6-9:sad(难过)/lonely(孤独)/excited(兴奋)/angry(生气)/love(爱心)</li>
              <li>Lv 10+:sick(生病)/celebrating(庆祝)</li>
            </ul>
          </div>
        )}

        {unlockConfig?.enabled && (
          <div
            className="setting-row"
            style={{ flexDirection: 'column', alignItems: 'flex-start' }}
          >
            <span style={{ fontSize: '12px', color: '#888' }}>
              自定义状态解锁等级(留空则使用 manifest 默认值):
            </span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '6px',
                margin: '6px 0',
                width: '100%',
              }}
            >
              {STANDARD_NURTURE_STATES.map((name) => (
                <label
                  key={name}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                >
                  <span style={{ minWidth: '64px' }}>{name}</span>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    placeholder="默认"
                    value={thresholdDraft[name] ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      setThresholdDraft((prev) => {
                        const next = { ...prev }
                        if (v === '') delete next[name]
                        else next[name] = Number(v)
                        return next
                      })
                    }}
                    style={{ width: '56px' }}
                  />
                </label>
              ))}
            </div>
            <button
              className="save-btn"
              style={{ marginTop: '4px' }}
              onClick={() => void handleSaveThresholds()}
            >
              💾 保存自定义阈值
            </button>
          </div>
        )}

        <div className="setting-row">
          <span>状态切换冷却</span>
        </div>
        <div className="setting-row">
          <span style={{ fontSize: '12px', color: '#888' }}>
            防止边界值波动导致频繁切换状态(如饱腹值在 20 附近波动时 hungry/idle 频繁切换)
          </span>
        </div>
        <label className="setting-row">
          <span>冷却时间 (ms)</span>
          <input
            type="number"
            min="0"
            max="30000"
            step="500"
            value={transitionConfig?.globalCooldownMs ?? 3000}
            disabled={!transitionConfig}
            onChange={(e) => void handleCooldownChange(parseInt(e.target.value, 10) || 0)}
          />
        </label>
        {nurtureError && <div className="settings-error">{nurtureError}</div>}
      </div>

      <button className="save-btn" onClick={handleSave} disabled={saving}>
        {saving ? '⏳ 保存中...' : saved ? '✅ 已保存' : '💾 保存设置'}
      </button>
      {error && <div className="settings-error">{error}</div>}
    </div>
  )
}
